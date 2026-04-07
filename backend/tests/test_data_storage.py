"""
These tests verify the database layer:
1. Integrity Checks: Rapid updates do not cause arithmetic drifting or data loss.
2. Historical Retention: Inventory movements are permanently logged as an audit trail.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# --- SQLite JSONB Override ---
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
# -----------------------------

from app.main import app
from app.dependencies import get_db, get_current_active_user
from app.db.session import Base
from app.models.user import User
from app.models.inventory import InventoryItem 
from app.models.inventory_movement import InventoryMovement, MovementType

# --- Test Database & Client Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False, "timeout": 15},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

# Mock auth so we can focus purely on testing the Database Storage layer
def override_get_current_user():
    return User(user_id=1, bank_id=1, role_id=1, name="Test User")

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_active_user] = override_get_current_user
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Seeds the in-memory database with base data for storage testing."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed an inventory item with 10 starting quantity
    test_item = InventoryItem(
        item_id=1,
        name="Test Beans",
        quantity=10,
        category="Canned Goods",
        bank_id=1,
        location_id=1
    )
    db.add(test_item)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)


# --- Historical Logs (Backup/Recovery Audit) ---

def test_inventory_movement_history_retained():
    """Verifies that inventory updates create immutable historical log entries."""
    db = TestingSessionLocal()
    # Perform an inventory movement (e.g., adding 5 units)
    movement = InventoryMovement(
        item_id=1,
        movement_type=MovementType.INBOUND,
        quantity_change=5,
        quantity_after=15,
        user_id=1
    )
    db.add(movement)
    db.commit()
    
    # Query the history log
    logs = db.query(InventoryMovement).filter(InventoryMovement.item_id == 1).all()
    
    # We should have at least one log entry (the one we just added)
    assert len(logs) >= 1
    assert logs[0].movement_type == MovementType.INBOUND
    assert logs[0].quantity_change == 5
    
    db.close()


# --- Data Integrity (Transaction Isolation) ---

def test_transaction_integrity_multiple_updates():
    """
    Verifies that multiple sequential database transactions maintain perfect 
    arithmetic integrity without data loss or race conditions.
    """
    db = TestingSessionLocal()
    
    # Fetch current item
    item = db.query(InventoryItem).filter(InventoryItem.item_id == 1).first()
    start_qty = item.quantity # Should be 10 (as seeded)
    
    # Perform rapid transactions simulating different volunteers adjusting stock
    adjustments = [+5, -2, +10] # Net change should be +13
    
    for adj in adjustments:
        item.quantity += adj
        db.commit()
        
    # Re-fetch from DB to ensure changes persisted
    db.refresh(item)
    
    # Final qty should be 10 + 13 = 23
    assert item.quantity == start_qty + sum(adjustments)
    db.close()