from sqlalchemy import Column, Integer, String, Boolean, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

# Association table for many-to-many between inventory items and dietary restrictions
item_dietary_restrictions = Table(
    "item_dietary_restrictions",
    Base.metadata,
    Column("item_id", Integer, ForeignKey("inventory.item_id", ondelete="CASCADE"), primary_key=True),
    Column("dietary_restriction_id", Integer, ForeignKey("dietary_restrictions.id", ondelete="CASCADE"), primary_key=True),
)


class DietaryRestriction(Base):
    __tablename__ = "dietary_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    is_preset = Column(Boolean, default=False, nullable=False)
    preset_type = Column(String, nullable=True)  # "halal" | "kosher" | None
    color = Column(String, nullable=True)         # hex color for custom icons e.g. "#22c55e"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
