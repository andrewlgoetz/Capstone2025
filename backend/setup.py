"""Interactive one-time bootstrap for a fresh deployment."""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

_missing = [v for v in ("DATABASE_URL", "SECRET_KEY") if not os.environ.get(v)]
if _missing:
    print("\n[ERROR] Missing required environment variables:")
    for v in _missing:
        print(f"  - {v}")
    print("\nCopy backend/.env.example to backend/.env and fill in the values.")
    sys.exit(1)

from app.db.session import SessionLocal
from app.services import bootstrap_service


def _print_password_box(email: str, password: str) -> None:
    width = max(len(email), len(password)) + 14
    border = "=" * width
    print(f"\n{border}")
    print("  ADMIN ACCOUNT CREATED - SAVE THIS PASSWORD")
    print(border)
    print(f"  Email:    {email}")
    print(f"  Password: {password}")
    print()
    print("  You will be required to change this on first login.")
    print("  It will NOT be shown again.")
    print(f"{border}\n")


def main() -> None:
    print("\n" + "=" * 50)
    print("  FoodBank Inventory - First-Run Setup")
    print("=" * 50)
    print("\n  Note: Run 'alembic upgrade head' before this script.")

    db = SessionLocal()
    try:
        if not bootstrap_service.is_bootstrap_required(db):
            print("\n[ERROR] Bootstrap has already been completed for this deployment.")
            sys.exit(1)

        food_bank_name = input("\n  Food bank name: ").strip()
        if not food_bank_name:
            print("[ERROR] Name cannot be empty.")
            sys.exit(1)

        food_bank_address = input("  Address (press Enter to skip): ").strip() or None
        location_name = (
            input("  Location name (press Enter for 'Main Warehouse'): ").strip()
            or "Main Warehouse"
        )
        location_address = (
            input("  Location address (press Enter to skip): ").strip() or None
        )

        admin_email = input("  Admin email: ").strip().lower()
        if not admin_email or "@" not in admin_email:
            print("[ERROR] A valid email address is required.")
            sys.exit(1)

        admin_name = input("  Admin full name: ").strip()
        if not admin_name:
            print("[ERROR] A name is required.")
            sys.exit(1)

        include_dummy_inventory = (
            input("  Seed dummy inventory for testing? [y/N]: ").strip().lower() == "y"
        )

        result = bootstrap_service.bootstrap_database(
            db=db,
            food_bank_name=food_bank_name,
            food_bank_address=food_bank_address,
            location_name=location_name,
            location_address=location_address,
            admin_email=admin_email,
            admin_name=admin_name,
            include_dummy_inventory=include_dummy_inventory,
        )
    finally:
        db.close()

    print(f"\n  Categories inserted: {result.inserted_categories}")
    print(f"  Admin created: {result.admin_email}")
    print(f"  Dummy inventory seeded: {'yes' if result.included_dummy_inventory else 'no'}")
    _print_password_box(result.admin_email, result.temporary_password)

    print("\n" + "=" * 50)
    print("  Setup complete.")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    main()
