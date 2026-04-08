from sqlalchemy import Column, Integer, Float, String, Date
from app.db.demand_session import Base

# primary key: (date, store_id, prod_id, category)
class DemandInventory(Base):
    __tablename__ = "demand_inventory"
    # can deal with bank_id later
    # for now, database already populated with store IDs S001-S005
    # bank_id = Column(Integer, ForeignKey("food_banks.bank_id"), nullable=False)
    date = Column(Date, primary_key=True)
    store_id = Column(String, primary_key=True)
    product_id = Column(String, primary_key=True)
    category = Column(String, primary_key=True)
    region = Column(String)
    inventory_level = Column(Integer, default=0)
    units_sold = Column(Integer, default=0)
    units_ordered = Column(Integer, default=0)
    demand_forecast = Column(Float)
    price = Column(Float)
    discount = Column(Integer)
    weather_condition = Column(String)
    holiday_promo = Column(Integer)
    competitor_pricing = Column(Float)
    seasonality = Column(String)
