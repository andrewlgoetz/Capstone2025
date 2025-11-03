from sqlalchemy import Column, Integer, String
from app.db.session import Base

class FoodBank(Base):
    __tablename__ = "food_banks"

    bank_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    address = Column(String, nullable=True)