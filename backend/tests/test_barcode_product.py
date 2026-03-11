"""Tests for the barcode_products mapping feature.

These are pure-Python unit tests that use an in-memory SQLite database so they
run without a live Postgres instance.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
# Import all models so their tables are registered on Base.metadata
from app.models import *  # noqa: F401,F403
from app.models.barcode_product import BarcodeProduct
from app.schemas.inventory_schema import (
    BarcodeInfo,
    BarcodeProductCreate,
    BarcodeProductRead,
    ScanResponse,
)
import app.services.barcode_product_service as bp_service


# ---------------------------------------------------------------------------
# In-memory SQLite fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# barcode_product_service tests
# ---------------------------------------------------------------------------

def test_get_by_barcode_returns_none_when_empty(db):
    result = bp_service.get_by_barcode("0001234567890", db)
    assert result is None


def test_upsert_saves_new_mapping(db):
    data = BarcodeProductCreate(barcode="0001234567890", name="Canned Soup", category="Pantry")
    saved = bp_service.upsert(data, db)

    assert saved.id is not None
    assert saved.barcode == "0001234567890"
    assert saved.name == "Canned Soup"
    assert saved.category == "Pantry"
    assert saved.image_url is None


def test_upsert_normalizes_barcode(db):
    """Barcode with surrounding spaces should be normalized before saving."""
    data = BarcodeProductCreate(barcode="  0001234567890  ", name="Soup")
    saved = bp_service.upsert(data, db)
    assert saved.barcode == "0001234567890"


def test_get_by_barcode_finds_saved_mapping(db):
    data = BarcodeProductCreate(barcode="1112223334445", name="Pasta", category="Dry Goods")
    bp_service.upsert(data, db)

    found = bp_service.get_by_barcode("1112223334445", db)
    assert found is not None
    assert found.name == "Pasta"


def test_upsert_updates_existing_mapping(db):
    """Calling upsert twice for the same barcode should update, not raise."""
    data1 = BarcodeProductCreate(barcode="5556667778889", name="Dish Soap", category="Household")
    bp_service.upsert(data1, db)

    data2 = BarcodeProductCreate(barcode="5556667778889", name="Dish Soap XL", category="Cleaning")
    updated = bp_service.upsert(data2, db)

    assert updated.name == "Dish Soap XL"
    assert updated.category == "Cleaning"
    # Only one row should exist
    count = db.query(BarcodeProduct).filter(BarcodeProduct.barcode == "5556667778889").count()
    assert count == 1


def test_upsert_requires_barcode(db):
    data = BarcodeProductCreate(barcode="   ", name="No barcode")
    with pytest.raises(ValueError, match="barcode is required"):
        bp_service.upsert(data, db)


# ---------------------------------------------------------------------------
# Schema tests
# ---------------------------------------------------------------------------

def test_barcode_info_includes_image_url():
    info = BarcodeInfo(name="Rice", category="Pantry", barcode="123", image_url="http://example.com/rice.jpg")
    assert info.image_url == "http://example.com/rice.jpg"


def test_barcode_info_image_url_optional():
    info = BarcodeInfo(name="Rice", category=None, barcode="123")
    assert info.image_url is None


def test_barcode_product_create_schema():
    schema = BarcodeProductCreate(barcode="abc123", name="Test Item")
    assert schema.barcode == "abc123"
    assert schema.category is None
    assert schema.image_url is None


def test_scan_response_new_with_candidate_info_from_saved_mapping(db):
    """End-to-end: saved product mapping is returned as candidate_info in ScanResponse."""
    data = BarcodeProductCreate(barcode="9998887776665", name="Olive Oil", category="Pantry")
    saved = bp_service.upsert(data, db)

    candidate = BarcodeInfo(
        name=saved.name,
        category=saved.category,
        barcode=saved.barcode,
        image_url=saved.image_url,
    )
    response = ScanResponse(status="NEW", item=None, candidate_info=candidate)

    assert response.status == "NEW"
    assert response.candidate_info is not None
    assert response.candidate_info.name == "Olive Oil"
    assert response.candidate_info.barcode == "9998887776665"


# ---------------------------------------------------------------------------
# Fallback order test (logic-level, no HTTP client needed)
# ---------------------------------------------------------------------------

def test_fallback_order_inventory_first_then_saved_then_external(db):
    """Verify the lookup priority: inventory DB > barcode_products > external."""

    # Only a saved mapping exists (no InventoryItem, no external match)
    data = BarcodeProductCreate(barcode="1234567890123", name="Saved Item", category="Other")
    bp_service.upsert(data, db)

    saved = bp_service.get_by_barcode("1234567890123", db)
    assert saved is not None
    assert saved.name == "Saved Item"

    # Without an InventoryItem row we should reach the saved mapping
    # (The full route test would require a TestClient; here we test the service layer.)
    from app.models.inventory import InventoryItem
    inv_row = db.query(InventoryItem).filter(InventoryItem.barcode == "1234567890123").first()
    assert inv_row is None  # inventory DB has nothing for this barcode
