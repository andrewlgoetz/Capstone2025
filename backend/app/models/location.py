from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.session import Base

class Location(Base):
    __tablename__ = "locations"
    location_id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("food_banks.bank_id"), nullable=False)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    notes = Column(String, nullable=True)  # optional description like "by freezer"