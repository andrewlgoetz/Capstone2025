"""
These tests verify the data integrity layer of the CSV importer, specifically:
1. Successful processing of correctly formatted files.
2. Safe rejection and error reporting of malformed files.
3. Assurance that partial uploads commit valid rows without corrupting existing data.
"""

import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- SQLite JSONB Override ---
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
# -----------------------------

from app.api.inventory_routes import bulk_import_csv
from app.models.inventory import InventoryItem

# --- Test Database Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """Fixture to create a fresh database session for each test."""
    from app.models.user import Base 
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

# --- Mocks for Fast & Isolated Testing ---
class MockUser:
    """Bypasses the JWT token auth to strictly test the parsing logic."""
    def __init__(self):
        self.user_id = 1
        self.bank_id = 1

class MockUploadFile:
    """Mocks FastAPI's UploadFile to test async reading without HTTP requests."""
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content
        
    async def read(self):
        return self.content


# --- Correctly formatted CSV files are processed successfully ---

def test_bulk_upload_valid_csv(db_session):
    """Verifies a perfectly formatted CSV successfully creates inventory records."""
    csv_content = (
        b"name,category,barcode,quantity,unit,expiration_date,location_id\n"
        b"Apples,Produce,12345,50,lbs,2026-12-31,1\n"
        b"Bananas,Produce,67890,30,lbs,2026-12-31,1\n"
    )
    file = MockUploadFile(filename="test.csv", content=csv_content)
    
    # Run the async endpoint synchronously
    result = asyncio.run(bulk_import_csv(file=file, db=db_session, current_user=MockUser()))
    
    assert result.total_items == 2
    assert result.successful == 2
    assert result.failed == 0
    
    # Verify they were actually saved
    items = db_session.query(InventoryItem).all()
    assert len(items) == 2
    assert items[0].name == "Apples"


# --- Malformed files are rejected safely ---

def test_bulk_upload_malformed_csv(db_session):
    """Verifies missing columns and invalid data types are caught without crashing."""
    csv_content = (
        b"name,category,barcode,quantity\n"
        b"Apples,Produce,12345,not_a_number\n" # Invalid quantity string (ValueError)
        b"Bananas,Produce,67890,\n"            # Missing quantity value (ValueError)
    )
    file = MockUploadFile(filename="bad.csv", content=csv_content)
    
    result = asyncio.run(bulk_import_csv(file=file, db=db_session, current_user=MockUser()))
    
    assert result.successful == 0
    assert result.failed == 2
    assert len(result.errors) == 2
    
    # Verify nothing bad was committed to the database
    items = db_session.query(InventoryItem).all()
    assert len(items) == 0


# --- Partial uploads do not corrupt existing inventory data ---

def test_bulk_upload_partial_success(db_session):
    """Verifies that in a mixed file, good rows are committed and bad rows are caught."""
    csv_content = (
        b"name,category,barcode,quantity,unit,expiration_date,location_id\n"
        b"Valid Item,Canned,111,10,,,1\n"
        b"Invalid Item,Canned,222,not_a_number,,,1\n" # This row will fail
    )
    file = MockUploadFile(filename="partial.csv", content=csv_content)
    
    result = asyncio.run(bulk_import_csv(file=file, db=db_session, current_user=MockUser()))
    
    assert result.total_items == 2
    assert result.successful == 1
    assert result.failed == 1
    
    # Verify the database transaction didn't blow up and the good item exists
    items = db_session.query(InventoryItem).all()
    assert len(items) == 1
    assert items[0].name == "Valid Item"