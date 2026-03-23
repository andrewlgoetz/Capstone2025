from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class Checkout(Base):
    __tablename__ = "checkout"

    checkout_id = Column(Integer, primary_key=True, index=True)
    served_by_user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    patron_id = Column(String, nullable=True)
    patron_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CheckoutItem(Base):
    __tablename__ = "checkout_item"

    checkout_item_id = Column(Integer, primary_key=True, index=True)
    checkout_id = Column(Integer, ForeignKey("checkout.checkout_id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("inventory.item_id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.location_id"), nullable=True)
    quantity = Column(Integer, nullable=False)