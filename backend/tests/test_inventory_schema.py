"""Unit tests for Pydantic inventory schemas."""

from datetime import datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.inventory_schema import (
    InventoryRead,
    QuantityDelta,
    ScanOutConfirmRequest,
    ScanResponse,
)


def _build_inventory_read() -> InventoryRead:
    """Create a fully populated InventoryRead instance for schema tests."""
    now = datetime.utcnow()
    return InventoryRead(
        item_id=1,
        bank_id=99,
        name="Shelf Stable Milk",
        category="Dairy",
        barcode="0001234567890",
        quantity=12,
        unit="case",
        expiration_date=now.date() + timedelta(days=30),
        location_id=7,
        last_modified=now,
        date_added=now,
        created_by=1001,
        modified_by=1002,
    )


def test_scan_out_confirm_request_requires_positive_quantity():
    request = ScanOutConfirmRequest(quantity=3)
    assert request.quantity == 3

    with pytest.raises(ValidationError):
        ScanOutConfirmRequest(quantity=0)


def test_quantity_delta_enforces_strictly_positive_amount():
    delta = QuantityDelta(amount=5)
    assert delta.amount == 5

    with pytest.raises(ValidationError):
        QuantityDelta(amount=-2)


def test_scan_response_accepts_known_items_and_rejects_invalid_status():
    item = _build_inventory_read()
    response = ScanResponse(status="KNOWN", item=item)

    assert response.item == item
    assert response.status == "KNOWN"

    with pytest.raises(ValidationError):
        ScanResponse(status="UNKNOWN", item=item)
