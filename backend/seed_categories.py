"""Seed (or replace) the categories table with granular foodbank categories.

Run from the backend directory:
    python seed_categories.py

This script DELETES all existing categories and re-inserts the full list.
Run this after alembic migrations have been applied.
"""

from app.db.session import SessionLocal
from app.models.category import Category
from app.category_mappings import FOODBANK_CATEGORIES

db = SessionLocal()


def seed_categories():
    # Remove all existing categories
    deleted = db.query(Category).delete()
    db.commit()
    print(f"Deleted {deleted} existing categories.")

    # Insert new granular categories
    for cat in FOODBANK_CATEGORIES:
        db.add(Category(
            name=cat["name"],
            description=cat.get("description"),
            display_order=cat.get("display_order", 0),
            is_active=True,
        ))
    db.commit()
    print(f"Inserted {len(FOODBANK_CATEGORIES)} categories.")

    # Print summary
    print("\nCategories seeded:")
    for cat in FOODBANK_CATEGORIES:
        print(f"  [{cat['display_order']:>3}] {cat['name']}")


if __name__ == "__main__":
    seed_categories()
    db.close()
    print("\nDone.")
