from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.barcode_service import lookup_barcode
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.food_banks import FoodBank
from app.schemas.inventory_schema import InventoryCreate, InventoryRead,ScanRequest,ScanResponse,BarcodeInfo
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


@router.post("/scan", response_model=ScanResponse)
def upsert_scanned_item(payload: ScanRequest, db: Session = Depends(get_db)):

    if not payload.barcode:
        raise HTTPException(status_code=400, detail="barcode is required")
    # code = _normalize_barcode(payload.barcode)
    code= inventory_service.normalize_barcode(payload.barcode)

    # Barcode exists
    existing = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
    if existing:
        return ScanResponse(
            status="KNOWN",
            item=InventoryRead.from_orm(existing),
            candidate_info=None
        )
    
    #Barcode does not exist
    info = {}
    try:
        info = lookup_barcode(code) or {}
    except Exception:
        info = {}
    
    # Pass candidate back to frontend
    # Whatever fields a barcode/item has
    candidate = BarcodeInfo(
        name=info.get("name"),
        category = info.get("category")
    )

    return ScanResponse(status="NEW", item = None, candidate = candidate)
