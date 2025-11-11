from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

# class InventoryRead(BaseModel):
#     item_id: int
#     name: str
#     category: Optional[str]
#     barcode: Optional[str]
#     quantity: int
#     unit: Optional[str]
#     expiration_date: Optional[date]
#     location_id: Optional[int]
#     date_added: Optional[datetime] = None
#     last_modified: Optional[datetime] = None

# class InventoryCreate(InventoryRead):
#     pass

class InventoryCreate(BaseModel):
    # item_id: int
    name: str
    category: Optional[str] = None
    barcode: Optional[str] = None
    quantity: int
    unit: Optional[str] = None
    expiration_date: Optional[date] = None
    location_id: Optional[int] = None

class InventoryRead(InventoryCreate):
    # item_id: int
    bank_id: int
    date_added: Optional[datetime] = None
    last_modified: Optional[datetime] = None

    model_config = {"from_attributes": True}