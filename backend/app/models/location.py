from sqlalchemy import Column, Integer, String
from app.db.session import Base

class Location(Base):
    __tablename__ = "locations"
    location_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String)