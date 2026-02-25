from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class InventoryItem(Base):
    __tablename__ = "inventory"

    item_id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("food_banks.bank_id"), nullable=False)

    name = Column(String, nullable=False)
    category = Column(String)
    category_notes = Column(String, nullable=True)
    barcode = Column(String, unique=True, index=True)
    quantity = Column(Integer, default=0)
    unit = Column(String)
    expiration_date = Column(Date, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    date_added = Column(DateTime(timezone=True), server_default=func.now())
    last_modified = Column(DateTime(timezone=True), onupdate=func.now())
    # audit tracking
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    modified_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)