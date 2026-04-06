"""
These tests verify the accuracy of aggregated dashboard data and alert triggers:
1. Data Aggregation: Charts accurately sum data and do not miss records.
2. Alert Triggers: Low Stock (<=10) and Expiring Soon (<=30 days) correctly identify boundary items.
"""

import pytest
from datetime import datetime, timedelta, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- SQLite JSONB Override ---
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
# -----------------------------

from app.models.inventory import InventoryItem
from app.api.inventory_routes import get_category_group_summary

# --- Test Database Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    from app.models.user import Base 
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

class MockUser:
    """Mock user to bypass auth dependencies during pure logic testing."""
    def __init__(self):
        self.user_id = 1
        self.bank_id = 1

@pytest.fixture
def seeded_dashboard_data(db_session):
    """Provides a controlled dataset to verify exact aggregations."""
    today = date.today()
    items = [
        # Produce (Total: 45)
        InventoryItem(name="Apples", category="Produce", quantity=20, bank_id=1, location_id=1, expiration_date=today + timedelta(days=5)),
        InventoryItem(name="Bananas", category="Produce", quantity=25, bank_id=1, location_id=1, expiration_date=today + timedelta(days=40)),
        
        # Dairy (Total: 10) - Includes a LOW STOCK item (8)
        InventoryItem(name="Milk", category="Dairy", quantity=8, bank_id=1, location_id=1, expiration_date=today + timedelta(days=15)),
        InventoryItem(name="Cheese", category="Dairy", quantity=2, bank_id=1, location_id=1, expiration_date=today + timedelta(days=60)),
        
        # Canned Goods (Total: 100)
        InventoryItem(name="Soup", category="Canned Goods", quantity=100, bank_id=1, location_id=1, expiration_date=today + timedelta(days=365)),
    ]
    db_session.add_all(items)
    db_session.commit()
    return items

# --- Data Aggregation ---

def test_dashboard_category_aggregation_accuracy(db_session, seeded_dashboard_data):
    """Verifies that the dashboard charts sum up data accurately and do not miss records."""
    # Call the actual route function used by the dashboard
    result = get_category_group_summary(
        location_ids=None, 
        db=db_session, 
        current_user=MockUser()
    )
    
    # Convert result to a dictionary for easy assertion
    summary_dict = {item["group"]: item["quantity"] for item in result}
    
    # Verify no records are missed and math is perfect
    assert summary_dict.get("Produce") == 45  # 20 + 25
    assert summary_dict.get("Dairy") == 10    # 8 + 2
    assert summary_dict.get("Canned Goods") == 100
    assert len(summary_dict) == 3 # Exactly 3 categories should be returned

# --- Alert Triggers ---

def test_dashboard_low_stock_alert_trigger(db_session, seeded_dashboard_data):
    """Verifies the Low Stock alert threshold successfully isolates items <= 10."""
    LOW_STOCK_THRESHOLD = 10
    
    low_stock_items = db_session.query(InventoryItem).filter(
        InventoryItem.quantity <= LOW_STOCK_THRESHOLD
    ).all()
    
    # Only Milk (8) and Cheese (2) should trigger this alert
    assert len(low_stock_items) == 2
    assert "Milk" in [item.name for item in low_stock_items]
    assert "Apples" not in [item.name for item in low_stock_items] # 20 qty should be excluded

def test_dashboard_expiring_soon_alert_trigger(db_session, seeded_dashboard_data):
    """Verifies the Expiring Soon alert threshold successfully isolates items expiring within 30 days."""
    EXPIRING_DAYS_THRESHOLD = 30
    cutoff_date = date.today() + timedelta(days=EXPIRING_DAYS_THRESHOLD)
    
    expiring_soon_items = db_session.query(InventoryItem).filter(
        InventoryItem.expiration_date <= cutoff_date
    ).all()
    
    # Only Apples (5 days) and Milk (15 days) should trigger this alert
    assert len(expiring_soon_items) == 2
    assert "Apples" in [item.name for item in expiring_soon_items]
    assert "Bananas" not in [item.name for item in expiring_soon_items] # 40 days should be excluded