from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base  # Import your declarative Base

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://myuser:mypassword@localhost:5432/inventory_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()