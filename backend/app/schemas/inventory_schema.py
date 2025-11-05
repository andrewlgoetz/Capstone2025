from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class InventoryRead(BaseModel):
    item_id: int
    name: str
    category: Optional[str]
    barcode: Optional[str]
    quantity: int
    unit: Optional[str]
    expiration_date: Optional[date]
    location_id: Optional[int]
    date_added: Optional[datetime] = None
    last_modified: Optional[datetime] = None

class InventoryCreate(InventoryRead):
    pass

    class Config:
        orm_mode = True