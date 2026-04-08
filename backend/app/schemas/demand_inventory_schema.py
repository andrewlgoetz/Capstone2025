from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class DemandBase(BaseModel):
    date: date
    store_id: str
    product_id: str
    category: str
    inventory_level: int
    units_sold: int
    units_ordered: int
    weather_conditions: Optional[str]
    seasonality: Optional[str]

class DemandCreate(DemandBase):
    pass

class DemandRead(DemandBase):
    date: date
    store_id: str
    product_id: str
    category: str
    inventory_level: int
    units_sold: int
    units_ordered: int
    date_added: Optional[datetime] = None
    last_modified: Optional[datetime] = None

    class Config:
        orm_mode = True