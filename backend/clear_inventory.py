"""Delete all inventory items and related movement/activity records.

Run from the backend directory:
    python clear_inventory.py

Use this to wipe inventory data before re-running seed_db.py with new categories.
Roles, food banks, locations, users, and categories are NOT affected.
"""

from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement
from app.models.activity_log import ActivityLog

db = SessionLocal()


def clear_inventory():
    # Delete movements and activity logs that reference inventory items first
    movements = db.query(InventoryMovement).delete()
    db.commit()
    print(f"Deleted {movements} inventory movement records.")

    activity = db.query(ActivityLog).filter(ActivityLog.entity_type == "inventory").delete()
    db.commit()
    print(f"Deleted {activity} inventory activity log records.")

    items = db.query(InventoryItem).delete()
    db.commit()
    print(f"Deleted {items} inventory items.")


if __name__ == "__main__":
    confirm = input("This will DELETE all inventory data. Type 'yes' to continue: ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
    else:
        clear_inventory()
        db.close()
        print("\nInventory cleared. You can now run seed_db.py to re-seed.")
