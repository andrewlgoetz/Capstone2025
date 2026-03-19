from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.barcode_service import lookup_barcode
from app.models.inventory import InventoryItem
from app.models.food_banks import FoodBank
from app.models.user import User
from app.models.category import Category
from app.schemas.inventory_schema import * # InventoryCreate, InventoryRead,ScanRequest,ScanResponse,BarcodeInfo, ScanOutResponse
import app.services.inventory_service as inventory_service
from app.models.inventory_movement import MovementType
from app.models.activity_log import ActivityLog, ActivityAction
from app.dependencies import get_db
from app.services.permission_service import Permission, require_permission
from app.category_mappings import match_off_to_category

router = APIRouter(prefix="/barcode", tags=["Barcode"])


def log_activity(db: Session, user_id: int, action: ActivityAction, entity_id: int, item_name: str, details: str = None):
    entry = ActivityLog(
        user_id=user_id, action=action, entity_type="inventory",
        entity_id=entity_id, item_name=item_name, details=details,
    )
    db.add(entry)
    db.commit()

@router.get("/{barcode}")
def get_barcode(
    barcode: str,
    current_user: User = Depends(require_permission(Permission.SCAN_IN))
):
    data = lookup_barcode(barcode)
    if not data:
        raise HTTPException(status_code=404, detail="Barcode not found in registry")
    return data


@router.post("/add", response_model=InventoryRead)
def add_item(
    item: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_CREATE))
):
    new_item = inventory_service.add_item(item, db)
    log_activity(db, current_user.user_id, ActivityAction.CREATE, new_item.item_id, new_item.name,
                 f"Added via barcode scan with qty {new_item.quantity}")
    return new_item

@router.post("/scan-out", response_model=ScanOutResponse)
def scan_out_lookup(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SCAN_OUT))
):
    code = inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    db_item = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.barcode == code,
            InventoryItem.bank_id == current_user.bank_id
        )
        .first()
    )

    if not db_item:
        return ScanOutResponse(status="NOT_FOUND", item=None)

    return ScanOutResponse(
        status="FOUND",
        item=InventoryRead.model_validate(db_item),
    )

#make this optional
@router.post("/scan-out/{item_id}/confirm", response_model=InventoryRead)
def confirm_scan_out(
    item_id: int,
    payload: ScanOutConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SCAN_OUT))
):
    updated = inventory_service.adjust_item_quantity(
        item_id=item_id,
        delta=-payload.quantity,
        db=db,
        movement_type=MovementType.OUTBOUND,
        user_id=current_user.user_id
    )
    if payload.location_id is not None:
        updated.location_id = payload.location_id
        db.commit()
        db.refresh(updated)
    log_activity(db, current_user.user_id, ActivityAction.SCAN_OUT, updated.item_id, updated.name,
                 f"Scanned out qty {payload.quantity}, remaining {updated.quantity}, location {payload.location_id}")
    return InventoryRead.model_validate(updated)

@router.post("/scan-in", response_model=ScanResponse)
def upsert_scanned_item(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.SCAN_IN))
):
    code = inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    # Barcode exists — check DB directly (filter by user's bank)
    existing = db.query(InventoryItem).filter(
        InventoryItem.barcode == code,
        InventoryItem.bank_id == current_user.bank_id
    ).first()
    if existing:
        return ScanResponse(
            status="KNOWN",
            item=InventoryRead.model_validate(existing),
            candidate_info=None
        )

    # Barcode does not exist in our DB — ask the barcode registry
    info = lookup_barcode(code)
    if info:
        # Try to match the raw OFF categories string against active DB categories
        off_cats = info.get("off_categories", "") if isinstance(info, dict) else ""
        active_category_names = [
            c.name for c in db.query(Category).filter(Category.is_active == True).all()
        ]
        matched_category = match_off_to_category(off_cats, active_category_names) if off_cats else None

        candidate = BarcodeInfo(
            name=info.get("name") if isinstance(info, dict) else None,
            category=matched_category,  # None if no match — user fills in
            barcode=info.get("barcode") if isinstance(info, dict) else code,
        )
        return ScanResponse(status="NEW", item=None, candidate_info=candidate)

    # No candidate info available
    return ScanResponse(status="NEW", item=None, candidate_info=None)

@router.post("/{item_id}/increase", response_model=InventoryRead)
def increase_item_quantity(
    item_id: int,
    payload: QuantityDelta,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_EDIT))
):
    updated = inventory_service.adjust_item_quantity(item_id=item_id, delta=payload.amount, db=db, user_id=current_user.user_id)
    if payload.location_id is not None:
        updated.location_id = payload.location_id
        db.commit()
        db.refresh(updated)
    log_activity(db, current_user.user_id, ActivityAction.SCAN_IN, updated.item_id, updated.name,
                 f"Scanned in qty {payload.amount}, new total {updated.quantity}, location {payload.location_id}")
    return InventoryRead.model_validate(updated)