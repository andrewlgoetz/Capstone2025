from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.inventory_movement import MovementType

class InventoryMovementBase(BaseModel):
    item_id: int
    quantity_change: int
    movement_type: MovementType
    reason: Optional[str] = None

class InventoryMovementCreate(InventoryMovementBase):
    pass

class InventoryMovementRead(InventoryMovementBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True