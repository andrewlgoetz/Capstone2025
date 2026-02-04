from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from app.db.session import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)

    # Flag to force password change on first login
    requires_password_change = Column(Boolean, default=False, nullable=False)

    # Link to a role (permissions) and food bank (ownership)
    role_id = Column(Integer, ForeignKey("roles.role_id"), nullable=True)
    bank_id = Column(Integer, ForeignKey("food_banks.bank_id"), nullable=False)
