from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.models.activity_log import ActivityLog, ActivityAction
from app.models.user_location import UserLocation
from app.models.user import User
from app.schemas.inventory_schema import InventoryCreate, InventoryRead, InventoryUpdate
import app.services.barcode_service as barcode_service
import app.services.inventory_service as inventory_service
from app.models.location import Location
from app.dependencies import get_db
from app.services.permission_service import Permission, require_permission, require_any_permission, require_all_permissions
from app.services import auth_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


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
    new_item = inventory_service.add_item(item, db)
    log_activity(db, current_user.user_id, ActivityAction.CREATE, new_item.item_id, new_item.name,
                 f"Added with qty {new_item.quantity}")
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

    updated = inventory_service.update_item(item_id, item, db)

    # build readable diff: only fields that actually changed
    diffs = [f"{k}: {old_vals[k]} → {sent[k]}" for k in sent if old_vals.get(k) != sent[k]]
    detail_str = ", ".join(diffs) if diffs else "no changes"
    log_activity(db, current_user.user_id, ActivityAction.UPDATE, updated.item_id, updated.name, detail_str)
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
