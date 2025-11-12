from pydantic import BaseModel, Field, ConfigDict
from datetime import date
from typing import Optional,Literal

class InventoryBase(BaseModel):
    name: str
    category: Optional[str]
    barcode: Optional[str]
    quantity: int
    unit: Optional[str]
    expiration_date: Optional[date]
    location_id: Optional[int] # do we want to store this here or in another object, review the relationship with bankID

class InventoryCreate(InventoryBase):
    pass

class ScanRequest(BaseModel):
    barcode: str
    quantity: int

class InventoryRead(InventoryBase):
    item_id: int
    date_added: Optional[date]

    class Config:
        orm_mode = True

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