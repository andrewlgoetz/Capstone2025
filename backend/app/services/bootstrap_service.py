"""One-time bootstrap logic for initializing a fresh deployment."""

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.category_mappings import FOODBANK_CATEGORIES
from app.constants import BANK_ID
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.food_banks import FoodBank
from app.models.location import Location
from app.models.role import Role
from app.models.user import User
from app.services import auth_service


@dataclass
class BootstrapResult:
    """Bootstrap outcome returned to API and CLI callers."""

    admin_user: User
    temporary_password: str
    inserted_categories: int


def is_bootstrap_required(db: Session) -> bool:
    """Return True when the deployment still needs initial setup."""
    return not (
        db.query(FoodBank).filter(FoodBank.bank_id == BANK_ID).first()
        or db.query(User).filter(User.role_id == 1).first()
        or db.query(Location).filter(Location.bank_id == BANK_ID).first()
    )


def ensure_bootstrap_required(db: Session) -> None:
    """Block bootstrap once the instance has already been initialized."""
    if not is_bootstrap_required(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bootstrap has already been completed for this deployment",
        )


def seed_roles(db: Session) -> None:
    """Ensure the core roles exist."""
    for role_id, name in [(1, "Admin"), (2, "Supervisor"), (3, "User")]:
        db.merge(Role(role_id=role_id, name=name))

    legacy = db.query(Role).filter(Role.role_id == 4).first()
    if legacy:
        db.delete(legacy)

    db.commit()


def seed_categories(db: Session) -> int:
    """Ensure the canonical food bank categories exist."""
    inserted = 0
    for i, cat in enumerate(FOODBANK_CATEGORIES):
        if not db.query(Category).filter(Category.name == cat["name"]).first():
            db.add(
                Category(
                    name=cat["name"],
                    description=cat.get("description"),
                    display_order=cat.get("display_order", i),
                    is_active=True,
                )
            )
            inserted += 1

    db.commit()
    return inserted


def create_food_bank(db: Session, name: str, address: str | None) -> FoodBank:
    """Create the single tenant food bank record."""
    food_bank = FoodBank(bank_id=BANK_ID, name=name, address=address)
    db.merge(food_bank)
    db.commit()
    return db.query(FoodBank).filter(FoodBank.bank_id == BANK_ID).first()


def create_location(db: Session, name: str, address: str | None) -> Location:
    """Create the primary location for the food bank."""
    location = Location(bank_id=BANK_ID, name=name, address=address)
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def bootstrap_database(
    *,
    db: Session,
    food_bank_name: str,
    food_bank_address: str | None,
    location_name: str,
    location_address: str | None,
    admin_email: str,
    admin_name: str,
) -> BootstrapResult:
    """Initialize a new deployment exactly once."""
    ensure_bootstrap_required(db)

    seed_roles(db)
    inserted_categories = seed_categories(db)
    create_food_bank(db, name=food_bank_name, address=food_bank_address)
    create_location(db, name=location_name, address=location_address)
    admin_user, temporary_password = auth_service.create_user(
        name=admin_name,
        email=admin_email,
        bank_id=BANK_ID,
        role_id=1,
        db=db,
    )

    return BootstrapResult(
        admin_user=admin_user,
        temporary_password=temporary_password,
        inserted_categories=inserted_categories,
    )


def reset_migrate_and_bootstrap(
    *,
    food_bank_name: str,
    food_bank_address: str | None,
    location_name: str,
    location_address: str | None,
    admin_email: str,
    admin_name: str,
) -> BootstrapResult:
    """Reset the database, rerun migrations, and apply bootstrap data."""
    from reset_db import reset_and_migrate_database

    reset_and_migrate_database()

    db = SessionLocal()
    try:
        return bootstrap_database(
            db=db,
            food_bank_name=food_bank_name,
            food_bank_address=food_bank_address,
            location_name=location_name,
            location_address=location_address,
            admin_email=admin_email,
            admin_name=admin_name,
        )
    finally:
        db.close()
