"""User permissions model - stores granular permissions for each user."""

from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.db.session import Base


class UserPermission(Base):
    """
    Stores individual permissions granted to users.
    Each row represents one permission granted to one user.
    """
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    permission = Column(String, nullable=False)

    # Ensure each user can only have each permission once
    __table_args__ = (
        UniqueConstraint('user_id', 'permission', name='uq_user_permission'),
    )
