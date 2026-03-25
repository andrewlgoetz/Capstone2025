"""
backfill_movements.py

Inserts one INBOUND movement row for every inventory item that currently has
NO movement history.  Safe to run against a live database — items that already
have at least one movement row are skipped.

Usage (from the backend/ directory, with the ml conda env active):
    python backfill_movements.py
"""

from datetime import datetime

from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType

db = SessionLocal()

try:
    # Collect item_ids that already have at least one movement row
    existing_item_ids = {
        row.item_id
        for row in db.query(InventoryMovement.item_id).distinct().all()
    }
    print(f"Items already with movement data: {len(existing_item_ids)}")

    # Fetch all inventory items
    items = db.query(InventoryItem).all()
    print(f"Total inventory items found: {len(items)}")

    added = 0
    for item in items:
        if item.item_id in existing_item_ids:
            continue  # already has history — leave it alone

        created_at = item.date_added if item.date_added else datetime(2025, 1, 1)

        movement = InventoryMovement(
            item_id=item.item_id,
            user_id=item.created_by,
            quantity_change=item.quantity,
            movement_type=MovementType.INBOUND,
            reason="Initial stock (backfilled)",
            created_at=created_at,
        )
        db.add(movement)
        added += 1

    db.commit()
    print(f"Done — inserted {added} INBOUND movement rows.")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
    raise
finally:
    db.close()
