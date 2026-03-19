from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.sql import func
from app.db.session import Base


class ActivityAction(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    SCAN_IN = "SCAN_IN"
    SCAN_OUT = "SCAN_OUT"
    CATEGORY_ASSIGN = "CATEGORY_ASSIGN"


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    action = Column(SAEnum(ActivityAction), nullable=False)
    entity_type = Column(String, nullable=False, default="inventory")
    entity_id = Column(Integer, nullable=True)
    item_name = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
