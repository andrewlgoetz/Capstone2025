from fastapi import APIRouter, HTTPException
from app.services.barcode_service import lookup_barcode

router = APIRouter(prefix="/barcode", tags=["Barcode"])

@router.get("/{barcode}")
def get_barcode(barcode: str):
    data = lookup_barcode(barcode)
    if not data:
        raise HTTPException(status_code=404, detail="Barcode not found in registry")
    return data
