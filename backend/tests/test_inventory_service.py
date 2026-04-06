"""
These tests verify the core inventory management logic, specifically:
1. Inventory totals update correctly when items are added or removed.
2. No incorrect arithmetic occurs during repeated updates, ensuring data integrity.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.schemas.inventory_schema import InventoryCreate, InventoryUpdate
from app.services.inventory_service import add_item, adjust_item_quantity, update_item

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

# --- Test Database Setup ---

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Fixtures ---
@pytest.fixture(scope="function")
def db_session():
    """Fixture to create a fresh database session for each test."""
    from app.models.user import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def sample_item(db_session):
    """Fixture to seed a test item."""
    item_data = InventoryCreate(
        name="Canned Beans",
        category="Canned Goods",
        barcode="100000111001",
        quantity=50,
        unit="cans",
        location_id=1,
        expiration_date=datetime.utcnow().date() + timedelta(days=30)
    )
    return add_item(item=item_data, db=db_session, user_id=1)

# --- Inventory totals update correctly (Add/Remove) ---

def test_adjust_item_quantity_addition(db_session, sample_item):
    """Verifies inventory totals update correctly when items are added."""
    initial_qty = sample_item.quantity
    add_amount = 25
    
    updated_item = adjust_item_quantity(
        item_id=sample_item.item_id, 
        delta=add_amount, 
        db=db_session, 
        movement_type=MovementType.INBOUND
    )
    
    assert updated_item.quantity == initial_qty + add_amount
    assert updated_item.quantity == 75

def test_adjust_item_quantity_removal(db_session, sample_item):
    """Verifies inventory totals update correctly when items are removed."""
    initial_qty = sample_item.quantity
    remove_amount = -15
    
    updated_item = adjust_item_quantity(
        item_id=sample_item.item_id, 
        delta=remove_amount, 
        db=db_session, 
        movement_type=MovementType.OUTBOUND
    )
    
    assert updated_item.quantity == initial_qty + remove_amount
    assert updated_item.quantity == 35

def test_adjust_item_quantity_prevents_negative_stock(db_session, sample_item):
    """Verifies that removing more than current stock safely raises an exception."""
    remove_amount = -60 # Item only has 50
    
    with pytest.raises(HTTPException) as excinfo:
        adjust_item_quantity(
            item_id=sample_item.item_id, 
            delta=remove_amount, 
            db=db_session
        )
    
    assert excinfo.value.status_code == 400
    assert "Insufficient stock" in excinfo.value.detail

# --- No incorrect arithmetic during repeated updates ---

def test_repeated_quantity_adjustments(db_session, sample_item):
    """Verifies no incorrect arithmetic occurs during repeated consecutive updates."""
    # Simulating a rapid sequence of scans by multiple volunteers
    adjustments = [10, -5, 20, -30, 2] # Net change: -3
    initial_qty = sample_item.quantity # Starts at 50
    
    for delta in adjustments:
        adjust_item_quantity(item_id=sample_item.item_id, delta=delta, db=db_session)
        
    final_item = db_session.query(InventoryItem).filter_by(item_id=sample_item.item_id).first()
    
    # 50 + 10 - 5 + 20 - 30 + 2 = 47
    assert final_item.quantity == 47

    # Verify that the correct number of movement logs were generated for traceability
    movements = db_session.query(InventoryMovement).filter_by(item_id=sample_item.item_id).all()
    assert len(movements) == 6 # 1 initial creation + 5 adjustments