from sqlalchemy import Column, Integer, String
from app.db.session import Base

class Role(Base):
    __tablename__ = "roles"
    role_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)