"""
First-run setup for the FoodBank Inventory System.

Run once after deploying to configure the database with required reference
data, a main location, and a bootstrap admin account.

Usage:
    python setup.py

Requirements:
    - .env file present with DATABASE_URL and SECRET_KEY set
    - Migrations already applied: alembic upgrade head
"""

import os
import sys

from dotenv import load_dotenv
load_dotenv()

# Pre-flight: check required env vars before importing app code
_missing = [v for v in ("DATABASE_URL", "SECRET_KEY") if not os.environ.get(v)]
if _missing:
    print("\n[ERROR] Missing required environment variables:")
    for v in _missing:
        print(f"  - {v}")
    print("\nCopy backend/.env.example to backend/.env and fill in the values.")
    sys.exit(1)

from fastapi import HTTPException
from app.db.session import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.food_banks import FoodBank
from app.models.location import Location
from app.models.category import Category
from app.services import auth_service
from app.category_mappings import FOODBANK_CATEGORIES
from app.constants import BANK_ID

TOTAL_STEPS = 5


def _step(n, msg):
    print(f"\n[{n}/{TOTAL_STEPS}] {msg}")


def _print_password_box(email, password):
    width = max(len(email), len(password)) + 14
    border = "=" * width
    print(f"\n{border}")
    print("  ADMIN ACCOUNT CREATED — SAVE THIS PASSWORD")
    print(border)
    print(f"  Email:    {email}")
    print(f"  Password: {password}")
    print()
    print("  You will be required to change this on first login.")
    print("  It will NOT be shown again.")
    print(f"{border}\n")


def step_seed_roles(db):
    _step(1, "Seeding roles")
    for role_id, name in [(1, "Admin"), (2, "Supervisor"), (3, "User")]:
        db.merge(Role(role_id=role_id, name=name))
    # Remove legacy roles if present (Manager=2 was renamed; Driver=4 unused)
    legacy = db.query(Role).filter(Role.role_id == 4).first()
    if legacy:
        db.delete(legacy)
    db.commit()
    print("  Roles ready: Admin, Supervisor, User.")


def step_seed_categories(db):
    _step(2, "Seeding categories")
    inserted = 0
    for i, cat in enumerate(FOODBANK_CATEGORIES):
        if not db.query(Category).filter(Category.name == cat["name"]).first():
            db.add(Category(
                name=cat["name"],
                description=cat.get("description"),
                display_order=cat.get("display_order", i),
                is_active=True,
            ))
            inserted += 1
    db.commit()
    total = len(FOODBANK_CATEGORIES)
    print(f"  {inserted} new categories inserted, {total - inserted} already present ({total} total).")


def step_create_food_bank(db):
    _step(3, "Configuring food bank")
    existing = db.query(FoodBank).filter(FoodBank.bank_id == BANK_ID).first()
    if existing:
        print(f"  Already configured: {existing.name}")
        return

    name = input("  Food bank name: ").strip()
    if not name:
        print("[ERROR] Name cannot be empty.")
        sys.exit(1)
    address = input("  Address (press Enter to skip): ").strip() or None

    db.merge(FoodBank(bank_id=BANK_ID, name=name, address=address))
    db.commit()
    print(f"  Food bank created: {name}")


def step_create_location(db):
    _step(4, "Creating main location")
    existing = db.query(Location).filter(Location.bank_id == BANK_ID).first()
    if existing:
        print(f"  Location already exists: {existing.name}")
        return

    name = input("  Location name (press Enter for 'Main Warehouse'): ").strip() or "Main Warehouse"
    address = input("  Address (press Enter to skip): ").strip() or None

    db.add(Location(bank_id=BANK_ID, name=name, address=address))
    db.commit()
    print(f"  Location created: {name}")


def step_create_admin(db):
    _step(5, "Creating admin account")
    existing_admin = db.query(User).filter(User.role_id == 1).first()
    if existing_admin:
        print(f"  Admin already exists ({existing_admin.email}). Skipping.")
        return

    email = input("  Admin email: ").strip()
    if not email or "@" not in email:
        print("[ERROR] A valid email address is required.")
        sys.exit(1)
    name = input("  Admin full name: ").strip()
    if not name:
        print("[ERROR] A name is required.")
        sys.exit(1)

    try:
        new_user, temp_pw = auth_service.create_user(
            name=name, email=email, bank_id=BANK_ID, role_id=1, db=db
        )
    except HTTPException as e:
        print(f"\n[ERROR] {e.detail}")
        sys.exit(1)

    _print_password_box(new_user.email, temp_pw)


def main():
    print("\n" + "=" * 50)
    print("  FoodBank Inventory — First-Run Setup")
    print("=" * 50)
    print("\n  Note: Run 'alembic upgrade head' before this script.")

    db = SessionLocal()
    try:
        step_seed_roles(db)
        step_seed_categories(db)
        step_create_food_bank(db)
        step_create_location(db)
        step_create_admin(db)
    finally:
        db.close()

    print("\n" + "=" * 50)
    print("  Setup complete.")
    print("  Start the server with:")
    print("    uvicorn app.main:app --host 0.0.0.0 --port 8000")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
