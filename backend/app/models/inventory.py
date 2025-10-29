from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class InventoryItem(Base):
    __tablename__ = "inventory"

    item_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String)
    barcode = Column(String, unique=True, index=True)
    quantity = Column(Integer, default=0)
    unit = Column(String)
    expiration_date = Column(Date, nullable=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"))
    date_added = Column(DateTime(timezone=True), server_default=func.now())
    last_modified = Column(DateTime(timezone=True), onupdate=func.now())