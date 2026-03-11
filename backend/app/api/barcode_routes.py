from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.services.barcode_service import lookup_barcode
import app.services.barcode_product_service as barcode_product_service
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.food_banks import FoodBank
from app.schemas.inventory_schema import * # InventoryCreate, InventoryRead,ScanRequest,ScanResponse,BarcodeInfo, ScanOutResponse
import app.services.inventory_service as inventory_service
from app.models.inventory_movement import MovementType

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
    # Debug: log payload
    print(f"[barcode_routes.confirm_scan_out] item_id={item_id}, payload={payload}")
    # Use negative delta to subtract
    updated = inventory_service.adjust_item_quantity(
        item_id=item_id,
        delta=-payload.quantity,
        db=db,
        movement_type =MovementType.OUTBOUND
    )
    return InventoryRead.model_validate(updated)

@router.post("/scan-in", response_model=ScanResponse)
def upsert_scanned_item(payload: ScanRequest, db: Session = Depends(get_db)):
    code = inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    # 1. Check inventory DB — known item already in stock
    existing = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
    if existing:
        return ScanResponse(
            status="KNOWN",
            item=InventoryRead.model_validate(existing),
            candidate_info=None,
        )

    # 2. Check our saved barcode-product mapping table
    saved_product = barcode_product_service.get_by_barcode(code, db)
    if saved_product:
        candidate = BarcodeInfo(
            name=saved_product.name,
            category=saved_product.category,
            barcode=saved_product.barcode,
            image_url=saved_product.image_url,
        )
        return ScanResponse(status="NEW", item=None, candidate_info=candidate)

    # 3. Fall back to external / dummy lookup
    info = lookup_barcode(code)
    if info:
        candidate = BarcodeInfo(
            name=info.get("name") if isinstance(info, dict) else None,
            category=info.get("category") if isinstance(info, dict) else None,
            barcode=info.get("barcode") if isinstance(info, dict) else code,
        )
        return ScanResponse(status="NEW", item=None, candidate_info=candidate)

    # 4. No candidate info available — manual entry required
    return ScanResponse(status="NEW", item=None, candidate_info=None)


@router.post("/product-mapping", response_model=BarcodeProductRead, status_code=201)
def save_product_mapping(payload: BarcodeProductCreate, db: Session = Depends(get_db)):
    """Persist a barcode -> product mapping so future scans auto-fill item details.

    Normalizes the barcode, then upserts: if the barcode already exists the
    existing mapping is updated and returned (HTTP 201 either way for simplicity).
    """
    code = inventory_service.normalize_barcode(payload.barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    from app.schemas.inventory_schema import BarcodeProductCreate as _BPC
    normalized_payload = _BPC(
        barcode=code,
        name=payload.name,
        category=payload.category,
        image_url=payload.image_url,
    )

    product = barcode_product_service.upsert(normalized_payload, db)
    return BarcodeProductRead.model_validate(product)

@router.post("/{item_id}/increase", response_model=InventoryRead)
def increase_item_quantity(
    item_id: int,
    payload: QuantityDelta,
    db: Session = Depends(get_db),
):
    updated = inventory_service.adjust_item_quantity(item_id=item_id, delta=payload.amount, db=db)
    return InventoryRead.model_validate(updated)