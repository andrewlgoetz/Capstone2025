from enum import Enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.sql import func
from app.db.session import Base

class MovementType(str, Enum):
    OUTBOUND = "OUTBOUND"       # given to client/org
    WASTE = "WASTE"             # expired, damaged etc.
    TRANSFER = "TRANSFER"       # moved between food banks
    
class InventoryMovement(Base):
    __tablename__ = "inventory_movement"
    id = Column(Integer, primary_key=True, index=True)

    item_id = Column(
        Integer,
        ForeignKey("inventory.item_id"),
        nullable=False,
        index=True,
    )
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(SAEnum(MovementType), nullable=False)
    reason = Column(String, nullable=True)
    from_location_id = Column(
        Integer,
        ForeignKey("locations.location_id"),
        nullable=True,
    )
    to_location_id = Column(
        Integer,
        ForeignKey("locations.location_id"),
        nullable=True,
    )
    # When this movement was recorded
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )