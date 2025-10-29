from pydantic import BaseModel
from datetime import date
from typing import Optional

class InventoryBase(BaseModel):
    name: str
    category: Optional[str]
    barcode: Optional[str]
    quantity: int
    unit: Optional[str]
    expiration_date: Optional[date]
    location_id: Optional[int]

class InventoryCreate(InventoryBase):
    pass

class InventoryRead(InventoryBase):
    item_id: int
    date_added: Optional[date]

    class Config:
        orm_mode = True