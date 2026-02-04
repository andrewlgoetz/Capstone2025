from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.barcode_service import lookup_barcode
from app.models.inventory import InventoryItem
from app.models.food_banks import FoodBank
from app.models.user import User
from app.schemas.inventory_schema import * # InventoryCreate, InventoryRead,ScanRequest,ScanResponse,BarcodeInfo, ScanOutResponse
import app.services.inventory_service as inventory_service
from app.models.inventory_movement import MovementType
from app.dependencies import get_db, get_current_active_user

router = APIRouter(prefix="/barcode", tags=["Barcode"])

@router.get("/{barcode}")
def get_barcode(
    barcode: str,
    current_user: User = Depends(get_current_active_user)
):
    data = lookup_barcode(barcode)
    if not data:
        raise HTTPException(status_code=404, detail="Barcode not found in registry")
    return data


@router.post("/add", response_model=InventoryRead)
def add_item(
    item: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # encapsulate this logic b/c its reused
    new_item = inventory_service.add_item(item, db)
    return new_item

@router.post("/scan-out", response_model=ScanOutResponse)
def scan_out_lookup(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
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
    current_user: User = Depends(get_current_active_user)
):
    # Debug: log payload
    print(f"[barcode_routes.confirm_scan_out] item_id={item_id}, payload={payload}")
    # Use negative delta to subtract
    updated = inventory_service.adjust_item_quantity(
        item_id=item_id,
        delta=-payload.quantity,
        db=db,
        movement_type=MovementType.OUTBOUND
    )
    return InventoryRead.model_validate(updated)

@router.post("/scan-in", response_model=ScanResponse)
def upsert_scanned_item(
    payload: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
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
        # return candidate info so frontend can prefill fields (status NEW)
        candidate = BarcodeInfo(
            name=info.get("name") if isinstance(info, dict) else None,
            category=info.get("category") if isinstance(info, dict) else None,
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
    current_user: User = Depends(get_current_active_user)
):
    updated = inventory_service.adjust_item_quantity(item_id=item_id, delta=payload.amount, db=db)
    return InventoryRead.model_validate(updated)