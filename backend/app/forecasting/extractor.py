"""
Data extraction layer for the forecasting pipeline.

Pulls OUTBOUND inventory movements from the database for a given food bank
and returns them as typed named tuples ready for the transform step.

Only OUTBOUND movements with a negative quantity_change are included
(the sign convention is that outflows are recorded as negative integers).
The returned quantity is made positive (absolute value) so downstream code
works with plain non-negative demand figures.
"""

from datetime import datetime, timedelta, timezone
from typing import List, NamedTuple

from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType


class OutboundRecord(NamedTuple):
    """Single OUTBOUND movement record, ready for aggregation."""
    created_at: datetime
    category: str        # raw value from inventory.category (may need normalisation)
    quantity: int        # absolute quantity (sign removed)


def extract_outbound(
    bank_id: int,
    db: Session,
    lookback_weeks: int = 156,   # 3 years; enough for future seasonal models
) -> List[OutboundRecord]:
    """
    Return all OUTBOUND movements for *bank_id* within the lookback window,
    joined to inventory so we have the category string and the bank_id filter.

    The query uses the composite index on (created_at, item_id) added by
    migration fc3a8d912b47, which makes this fast as the movement table grows.

    Args:
        bank_id:        Tenant boundary — only movements for this food bank.
        db:             Active SQLAlchemy session.
        lookback_weeks: How far back to pull data.  3 years covers enough
                        history for seasonal models while keeping query scope
                        bounded.

    Returns:
        List of OutboundRecord sorted chronologically ascending.
    """
    cutoff = datetime.now(tz=timezone.utc) - timedelta(weeks=lookback_weeks)

    rows = (
        db.query(
            InventoryMovement.created_at,
            InventoryItem.category,
            InventoryMovement.quantity_change,
        )
        .join(InventoryItem, InventoryMovement.item_id == InventoryItem.item_id)
        .filter(
            InventoryItem.bank_id == bank_id,
            InventoryMovement.movement_type == MovementType.OUTBOUND,
            InventoryMovement.quantity_change < 0,   # guard: real outflows only
            InventoryMovement.created_at >= cutoff,
        )
        .order_by(InventoryMovement.created_at.asc())
        .all()
    )

    return [
        OutboundRecord(
            created_at=row.created_at,
            category=row.category or "Other",
            quantity=abs(row.quantity_change),
        )
        for row in rows
    ]
