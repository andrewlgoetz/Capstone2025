from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class Checkin(Base):
    __tablename__ = "checkin"

    checkin_id = Column(Integer, primary_key=True, index=True)
    received_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    donor_name = Column(String, nullable=False)
    donor_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CheckinItem(Base):
    __tablename__ = "checkin_item"

    checkin_item_id = Column(Integer, primary_key=True, index=True)
    checkin_id = Column(Integer, ForeignKey("checkin.checkin_id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory.item_id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    quantity = Column(Integer, nullable=False)