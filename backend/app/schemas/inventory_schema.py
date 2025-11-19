from pydantic import BaseModel, Field, ConfigDict
from datetime import date,datetime
from typing import Optional,Literal
from app.models.inventory_movement import MovementType

class InventoryCreate(BaseModel):
    name: str
    category: Optional[str] = None
    barcode: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    expiration_date: Optional[date] = None
    location_id: Optional[int] = None
    last_modified: Optional[datetime] = None

class InventoryRead(InventoryCreate):
    model_config = ConfigDict(from_attributes=True)
    item_id: int
    bank_id: int
    date_added: datetime
    last_modified: Optional[datetime] = None
    created_by: Optional[int] = None
    modified_by: Optional[int] = None


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    expiration_date: Optional[date] = None
    location_id: Optional[int] = None
    last_modified: Optional[datetime] = None
    
    # used ONLY for InventoryMovement, not stored on InventoryItem
    movement_type: Optional[MovementType] = None   # OUTBOUND / TRANSFER / WASTE
    movement_reason: Optional[str] = None

class ScanRequest(BaseModel):
    barcode: str
    quantity: int


# TODO, this is the response model from a scan request 
# what info related to a barcdoe do we want to maintain
class BarcodeInfo(BaseModel):
    name: str
    category: Optional[str]
    barcode: Optional[str]

class ScanResponse(BaseModel):
    status: Literal["KNOWN", "NEW"]
    item: Optional[InventoryRead] = None
    candidate_info: Optional[BarcodeInfo] = None