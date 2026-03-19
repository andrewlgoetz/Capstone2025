from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session, aliased
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import Optional, List
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.models.activity_log import ActivityLog, ActivityAction
from app.models.user_location import UserLocation
from app.models.user import User
from app.schemas.inventory_schema import (
    InventoryCreate, InventoryRead, InventoryUpdate,
    BulkImportRequest, BulkImportResult, BulkImportItem
)
import app.services.barcode_service as barcode_service
import app.services.inventory_service as inventory_service
from app.models.location import Location
from app.dependencies import get_db
from app.services.permission_service import Permission, require_permission, require_any_permission, require_all_permissions
from app.services import auth_service
import csv
import io
from datetime import datetime

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("/history")
def get_inventory_history(
    limit: int = Query(20, description="Number of recent activities to fetch"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(Permission.INVENTORY_VIEW, Permission.DASHBOARD_VIEW))
):
    from app.models.user import User # Add this import
    
    movements = (
        db.query(
            InventoryMovement.id,
            InventoryMovement.quantity_change,
            InventoryMovement.movement_type,
            InventoryMovement.created_at,
            InventoryItem.name.label("item_name"),
            InventoryItem.category.label("category"),
            InventoryItem.unit.label("unit"),
            Location.name.label("location_name"),
            User.name.label("user_name") # Add this select
        )
        .join(InventoryItem, InventoryMovement.item_id == InventoryItem.item_id)
        .outerjoin(Location, InventoryItem.location_id == Location.location_id)
        .outerjoin(User, InventoryMovement.user_id == User.user_id) # Add this join
        .filter(InventoryItem.bank_id == current_user.bank_id)
        .order_by(InventoryMovement.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": m.id,
            "item_name": m.item_name,
            "category": m.category,
            "quantity_change": m.quantity_change,
            "movement_type": m.movement_type.value if hasattr(m.movement_type, 'value') else str(m.movement_type),
            "unit": m.unit,
            "location_name": m.location_name,
            "user_name": m.user_name or "System", # Pass user name
            "timestamp": m.created_at.isoformat() if m.created_at else None,
        }
        for m in movements
    ]

@router.get("/movements")
def get_inventory_movements(
    limit: int = Query(500, ge=1, le=5000, description="Maximum number of movement rows to fetch"),
    location_ids: Optional[str] = Query(None, description="Comma-separated location IDs to filter by"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
    requested = [int(x) for x in location_ids.split(",") if x.strip()] if location_ids else None
    allowed = get_allowed_location_ids(current_user, db, requested)

    from_location = aliased(Location)
    to_location = aliased(Location)

    query = (
        db.query(
            InventoryMovement.id,
            InventoryMovement.item_id,
            InventoryMovement.user_id,
            InventoryMovement.quantity_change,
            InventoryMovement.movement_type,
            InventoryMovement.reason,
            InventoryMovement.from_location_id,
            InventoryMovement.to_location_id,
            InventoryMovement.created_at,
            InventoryItem.name.label("item_name"),
            InventoryItem.category.label("item_category"),
            InventoryItem.unit.label("item_unit"),
            InventoryItem.barcode.label("item_barcode"),
            InventoryItem.quantity.label("current_quantity"),
            User.name.label("user_name"),
            from_location.name.label("from_location_name"),
            to_location.name.label("to_location_name"),
        )
        .join(InventoryItem, InventoryMovement.item_id == InventoryItem.item_id)
        .outerjoin(User, InventoryMovement.user_id == User.user_id)
        .outerjoin(from_location, InventoryMovement.from_location_id == from_location.location_id)
        .outerjoin(to_location, InventoryMovement.to_location_id == to_location.location_id)
        .filter(InventoryItem.bank_id == current_user.bank_id)
        .order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
    )

    if allowed is not None:
        query = query.filter(
            (InventoryMovement.from_location_id.in_(allowed))
            | (InventoryMovement.to_location_id.in_(allowed))
            | (
                (InventoryMovement.from_location_id.is_(None))
                & (InventoryMovement.to_location_id.is_(None))
                & (InventoryItem.location_id.in_(allowed))
            )
        )

    movements = query.limit(limit).all()

    return [
        {
            "id": m.id,
            "item_id": m.item_id,
            "item_name": m.item_name,
            "item_category": m.item_category,
            "item_unit": m.item_unit,
            "item_barcode": m.item_barcode,
            "current_quantity": m.current_quantity,
            "quantity_change": m.quantity_change,
            "movement_type": m.movement_type.value if hasattr(m.movement_type, "value") else str(m.movement_type),
            "reason": m.reason,
            "user_id": m.user_id,
            "user_name": m.user_name or "System",
            "from_location_id": m.from_location_id,
            "from_location_name": m.from_location_name,
            "to_location_id": m.to_location_id,
            "to_location_name": m.to_location_name,
            "timestamp": m.created_at.isoformat() if m.created_at else None,
            "raw": {
                "id": m.id,
                "item_id": m.item_id,
                "user_id": m.user_id,
                "quantity_change": m.quantity_change,
                "movement_type": m.movement_type.value if hasattr(m.movement_type, "value") else str(m.movement_type),
                "reason": m.reason,
                "from_location_id": m.from_location_id,
                "to_location_id": m.to_location_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            },
        }
        for m in movements
    ]

@router.get("/dashboard/monthly-distributed")
def get_monthly_distributed(
    location_ids: Optional[str] = Query(None, description="Comma-separated location IDs"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(Permission.INVENTORY_VIEW, Permission.DASHBOARD_VIEW))
):
    requested = [int(x) for x in location_ids.split(",") if x.strip()] if location_ids else None
    allowed = get_allowed_location_ids(current_user, db, requested)
    query = (
        db.query(func.coalesce(func.sum(func.abs(InventoryMovement.quantity_change)), 0))
        .join(InventoryItem, InventoryMovement.item_id == InventoryItem.item_id)
        .filter(
            InventoryItem.bank_id == current_user.bank_id,
            InventoryMovement.movement_type == MovementType.OUTBOUND,
            InventoryMovement.created_at >= func.date_trunc('month', func.current_date())
        )
    )

    if allowed is not None:
        query = query.filter(InventoryMovement.from_location_id.in_(allowed))

    distributed = query.scalar()

    return {"distributed": int(distributed)}

def get_allowed_location_ids(user: User, db: Session, requested_ids: Optional[List[int]] = None) -> Optional[List[int]]:
    """
    Determine which location IDs a user may query.
    Admins: requested_ids if given, else None (all).
    Non-admins: intersection of assigned and requested; defaults to assigned.
    """
    is_admin = auth_service.is_admin(user, db)

    if is_admin:
        return requested_ids  # None means no filter (all)

    assigned = [r.location_id for r in db.query(UserLocation.location_id).filter(UserLocation.user_id == user.user_id).all()]
    if not assigned:
        return []  # user has no locations → sees nothing

    if requested_ids:
        return [lid for lid in requested_ids if lid in assigned]
    return assigned


def log_activity(db: Session, user_id: int, action: ActivityAction, entity_id: int, item_name: str, details: str = None):
    """Record an inventory action in the activity log."""
    entry = ActivityLog(
        user_id=user_id,
        action=action,
        entity_type="inventory",
        entity_id=entity_id,
        item_name=item_name,
        details=details,
    )
    db.add(entry)
    db.commit()


# add a new item
@router.post("/add", response_model=InventoryRead)
def add_item(
    item: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.INVENTORY_CREATE))
):
    new_item = inventory_service.add_item(item, db, current_user.user_id)
    log_activity(db, current_user.user_id, ActivityAction.CREATE, new_item.item_id, new_item.name,
                 f"Added with qty {new_item.quantity}")
    # Log category assignment separately so supervisors can review selections
    if new_item.category:
        log_activity(db, current_user.user_id, ActivityAction.CATEGORY_ASSIGN, new_item.item_id,
                     new_item.name, f"Category set to '{new_item.category}'")
    return new_item

@router.put("/{item_id}", response_model=InventoryRead)
def update_item(
    item_id: int,
    item: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.INVENTORY_EDIT))
):
    # snapshot old values for the fields being changed
    old_item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    sent = item.model_dump(exclude_unset=True, exclude={"movement_type", "movement_reason"})
    old_vals = {k: getattr(old_item, k, None) for k in sent} if old_item else {}

    updated = inventory_service.update_item(item_id, item, db, current_user.user_id)

    # build readable diff: only fields that actually changed
    diffs = [f"{k}: {old_vals[k]} → {sent[k]}" for k in sent if old_vals.get(k) != sent[k]]
    detail_str = ", ".join(diffs) if diffs else "no changes"
    log_activity(db, current_user.user_id, ActivityAction.UPDATE, updated.item_id, updated.name, detail_str)
    # Log category change separately for Item Manager visibility
    if "category" in sent and old_vals.get("category") != sent["category"]:
        log_activity(db, current_user.user_id, ActivityAction.CATEGORY_ASSIGN, updated.item_id,
                     updated.name, f"Category changed: '{old_vals.get('category')}' → '{sent['category']}'")
    return updated

@router.get("/allwithlocation")
def get_inventory(
    location_ids: Optional[str] = Query(None, description="Comma-separated location IDs to filter by"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(Permission.INVENTORY_VIEW, Permission.DASHBOARD_VIEW))
):
    requested = [int(x) for x in location_ids.split(",") if x.strip()] if location_ids else None
    allowed = get_allowed_location_ids(current_user, db, requested)

    query = (
        db.query(
            InventoryItem.item_id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.quantity,
            InventoryItem.expiration_date,
            InventoryItem.location_id,
            Location.name.label("location_name"),
            Location.address.label("location_address"),
            Location.notes.label("location_notes"),
        )
        .outerjoin(Location, InventoryItem.location_id == Location.location_id)
        .filter(InventoryItem.bank_id == current_user.bank_id)
    )

    if allowed is not None:
        query = query.filter(InventoryItem.location_id.in_(allowed))

    results = query.all()

    return [
        {
            "item_id": r.item_id,
            "name": r.name,
            "category": r.category,
            "quantity": r.quantity,
            "expiration_date": r.expiration_date,
            "location_id": r.location_id,
            "location_name": r.location_name,
            "location_address": r.location_address,
            "location_notes": r.location_notes,
        }
        for r in results
    ]

@router.get("/all", response_model=list[InventoryRead])
def list_items(
    location_ids: Optional[str] = Query(None, description="Comma-separated location IDs to filter by"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
    requested = [int(x) for x in location_ids.split(",") if x.strip()] if location_ids else None
    allowed = get_allowed_location_ids(current_user, db, requested)

    query = db.query(InventoryItem).filter(InventoryItem.bank_id == current_user.bank_id)

    if allowed is not None:
        query = query.filter(InventoryItem.location_id.in_(allowed))

    return query.all()

@router.get("/{item_id}", response_model=InventoryRead)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
    item = db.query(InventoryItem).filter(
        InventoryItem.item_id == item_id,
        InventoryItem.bank_id == current_user.bank_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.INVENTORY_DELETE))
):
    item = db.query(InventoryItem).filter(
        InventoryItem.item_id == item_id,
        InventoryItem.bank_id == current_user.bank_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item_name = item.name
    item_id_val = item.item_id
    item_qty = item.quantity
    db.delete(item)
    db.commit()
    log_activity(db, current_user.user_id, ActivityAction.DELETE, item_id_val, item_name,
                 f"Deleted item (qty was {item_qty})")
    return {"message": "Item deleted successfully"}

@router.post("/bulk-import/csv", response_model=BulkImportResult)
async def bulk_import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.INVENTORY_CREATE))
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    content = await file.read()
    csv_text = content.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_text))

    successful = 0
    failed = 0
    errors = []

    for idx, row in enumerate(csv_reader, start=2):  # start=2 because row 1 is header
        try:
            expiration_date = None
            if row.get('expiration_date') and row['expiration_date'].strip():
                try:
                    expiration_date = datetime.strptime(row['expiration_date'].strip(), '%Y-%m-%d').date()
                except ValueError:
                    raise ValueError("Invalid date format for expiration_date. Use YYYY-MM-DD")

            location_id = None
            if row.get('location_id') and row['location_id'].strip():
                location_id = int(row['location_id'])

            item_data = InventoryCreate(
                name=row['name'].strip(),
                category=row.get('category', '').strip() or None,
                barcode=row.get('barcode', '').strip() or None,
                quantity=int(row['quantity']),
                unit=row.get('unit', '').strip() or None,
                expiration_date=expiration_date,
                location_id=location_id
            )

            new_item = inventory_service.add_item(item_data, db, current_user.user_id)
            log_activity(db, current_user.user_id, ActivityAction.CREATE, new_item.item_id, new_item.name,
                         f"Bulk import (row {idx})")
            successful += 1

        except KeyError as e:
            failed += 1
            errors.append({"row": idx, "error": f"Missing required field: {str(e)}"})
        except ValueError as e:
            failed += 1
            errors.append({"row": idx, "error": f"Invalid value: {str(e)}"})
        except HTTPException as e:
            failed += 1
            errors.append({"row": idx, "error": e.detail})
        except Exception as e:
            failed += 1
            errors.append({"row": idx, "error": f"Unexpected error: {str(e)}"})

    return BulkImportResult(
        total_items=successful + failed,
        successful=successful,
        failed=failed,
        errors=errors
    )

@router.post("/bulk-import/json", response_model=BulkImportResult)
def bulk_import_json(
    request: BulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.INVENTORY_CREATE))
):
    successful = 0
    failed = 0
    errors = []

    for idx, item_data in enumerate(request.items, start=1):
        try:
            inventory_item = InventoryCreate(
                name=item_data.name,
                category=item_data.category,
                barcode=item_data.barcode,
                quantity=item_data.quantity,
                unit=item_data.unit,
                expiration_date=item_data.expiration_date,
                location_id=item_data.location_id
            )

            new_item = inventory_service.add_item(inventory_item, db, current_user.user_id)
            log_activity(db, current_user.user_id, ActivityAction.CREATE, new_item.item_id, new_item.name,
                         f"Bulk import (item {idx})")
            successful += 1

        except HTTPException as e:
            failed += 1
            errors.append({"item_index": idx, "name": item_data.name, "error": e.detail})
        except Exception as e:
            failed += 1
            errors.append({"item_index": idx, "name": item_data.name, "error": f"Unexpected error: {str(e)}"})

    return BulkImportResult(
        total_items=len(request.items),
        successful=successful,
        failed=failed,
        errors=errors
    )
