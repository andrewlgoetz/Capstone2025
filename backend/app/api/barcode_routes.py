from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.barcode_service import lookup_barcode
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.food_banks import FoodBank
from app.schemas.inventory_schema import * # InventoryCreate, InventoryRead,ScanRequest,ScanResponse,BarcodeInfo, ScanOutResponse
import app.services.inventory_service as inventory_service

router = APIRouter(prefix="/barcode", tags=["Barcode"])

@router.get("/{barcode}")
def get_barcode(barcode: str):
    data = lookup_barcode(barcode)
    if not data:
        raise HTTPException(status_code=404, detail="Barcode not found in registry")
    return data


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _default_bank_id(db: Session) -> int:
    bank = db.query(FoodBank).order_by(FoodBank.bank_id.asc()).first()
    return bank.bank_id if bank else 1


@router.post("/add", response_model=InventoryRead)
def add_item(item: InventoryCreate, db: Session = Depends(get_db)):

    # encapsulate this logic b/c its reused
    new_item = inventory_service.add_item(item, db)

    return new_item

@router.post("/scan-out", response_model=ScanOutResponse)
def scan_out_lookup(payload: ScanRequest, db: Session = Depends(get_db)):
    code = inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    db_item = (
        db.query(InventoryItem)
        .filter(InventoryItem.barcode == code)
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
):
    # Use negative delta to subtract
    updated = inventory_service.adjust_item_quantity(
        item_id=item_id,
        delta=-payload.quantity,
        db=db,
    )
    return InventoryRead.model_validate(updated)

@router.post("/scan-in", response_model=ScanResponse)
def upsert_scanned_item(payload: ScanRequest, db: Session = Depends(get_db)):
    code= inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")
    # code = _normalize_barcode(payload.barcode)
    

    # Barcode exists — check DB directly (don't call service which raises if not found)
    existing = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
    if existing:
        return ScanResponse(
            status="KNOWN",
            item=InventoryRead.model_validate(existing),
            candidate_info=None
        )
    
    #Barcode does not exist
    info = lookup_barcode(code)
    if info:
        return ScanResponse(status="KNOWN", candidate_info=BarcodeInfo(**info))
    # Pass candidate back to frontend
    # Whatever fields a barcode/item has
    candidate = BarcodeInfo(
        name=info.get("name"),
        category = info.get("category")
    )

    return ScanResponse(status="NEW", item = None, candidate = candidate)

@router.post("/{item_id}/increase", response_model=InventoryRead)
def increase_item_quantity(
    item_id: int,
    payload: QuantityDelta,
    db: Session = Depends(get_db),
):
    updated = inventory_service.adjust_item_quantity(item_id=item_id, delta=payload.amount, db=db)
    return InventoryRead.model_validate(updated)