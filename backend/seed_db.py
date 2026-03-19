"""Seed script to populate the database with sample data for development.

Run from the backend directory:
    python seed_db.py

Note: Run migrations first (alembic upgrade head), then optionally run
seed_admin_user.py to create an admin user afterward.

All seeded users are given the Volunteer (basic user) role under bank_id=1.
"""

import bcrypt
from datetime import date
from app.db.session import SessionLocal
from app.models.food_banks import FoodBank
from app.models.role import Role
from app.models.user import User
from app.models.location import Location
from app.models.inventory import InventoryItem

db = SessionLocal()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed_roles():
    roles = [
        Role(role_id=1, name="Admin"),
        Role(role_id=2, name="Manager"),
        Role(role_id=3, name="Volunteer"),
        Role(role_id=4, name="Driver"),
    ]
    for role in roles:
        db.merge(role)
    db.commit()
    print("Roles seeded.")


def seed_food_banks():
    bank = FoodBank(
        bank_id=1,
        name="Hamilton Community Food Bank",
        address="500 King St E, Hamilton, ON",
    )
    db.merge(bank)
    db.commit()
    print("Food bank seeded.")


def seed_users():
    # All users belong to bank_id=1 with basic Volunteer role (role_id=3)
    users_data = [
        dict(user_id=1, name="Haley Johnson", email="haley@hamfoodbank.ca",  password="password123"),
        dict(user_id=2, name="Tony Singh",    email="tony@hamfoodbank.ca",   password="password123"),
        dict(user_id=3, name="Alex Rider",    email="alexr@hamfoodbank.ca",  password="password123"),
    ]
    for u in users_data:
        user = User(
            user_id=u["user_id"],
            name=u["name"],
            email=u["email"],
            password_hash=hash_password(u["password"]),
            role_id=3,   # Volunteer — basic user role
            bank_id=1,
            requires_password_change=False,
        )
        db.merge(user)
    db.commit()
    print("Users seeded.")


def seed_locations():
    # All locations under bank_id=1
    locations = [
        Location(location_id=1, name="Main Warehouse",    address="500 King St E",              bank_id=1, notes="A2"),
        Location(location_id=2, name="Freezer Room",      address="500 King St E - Unit B",     bank_id=1, notes="C2"),
        Location(location_id=3, name="Front Pantry",      address="500 King St E - Room 1",     bank_id=1, notes="B3"),
        Location(location_id=4, name="Cold Storage",      address="500 King St E - Basement",   bank_id=1, notes="B2"),
    ]
    for loc in locations:
        db.merge(loc)
    db.commit()
    print("Locations seeded.")


def seed_inventory():
    # All items: bank_id=1, location_ids 1-4, created_by/modified_by from user_ids 1-3
    items = [
        dict(item_id=1,  name="Canned Beans",       category="Canned Beans",                    barcode="100000111001", quantity=250, unit="cans",    expiration_date=date(2026, 5,  1),  location_id=1, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=2,  name="Peanut Butter",       category="Peanut Butter",                   barcode="100000111002", quantity=120, unit="jars",    expiration_date=date(2026, 2, 15),  location_id=1, bank_id=1, created_by=2, modified_by=2),
        dict(item_id=3,  name="Chicken Breasts",     category="Frozen Meat - Chicken / Poultry", barcode="100000111003", quantity=80,  unit="packs",   expiration_date=date(2026, 12, 20), location_id=2, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=4,  name="Pasta",               category="Pasta - Short",                   barcode="100000111004", quantity=300, unit="boxes",   expiration_date=date(2027, 1, 10),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=5,  name="Tomato Sauce",        category="Pasta / Tomato Sauce",            barcode="100000111005", quantity=200, unit="cans",    expiration_date=date(2026, 9, 15),  location_id=3, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=6,  name="Milk",                category="Milk - Fresh",                    barcode="100000111006", quantity=60,  unit="cartons", expiration_date=date(2026, 11, 10), location_id=4, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=7,  name="Rice",                category="Rice - White",                    barcode="100000111007", quantity=400, unit="bags",    expiration_date=date(2027, 3,  1),  location_id=1, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=8,  name="Apples",              category="Fresh Produce - Other Fruit",     barcode="100000111008", quantity=150, unit="kgs",     expiration_date=date(2026, 11, 5),  location_id=1, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=9,  name="Pasta Sauce",         category="Pasta / Tomato Sauce",            barcode="100000111009", quantity=220, unit="cans",    expiration_date=date(2026, 4,  1),  location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=10, name="Canned Corn",         category="Canned Vegetables - Corn",        barcode="100000111010", quantity=180, unit="cans",    expiration_date=date(2026, 6, 10),  location_id=1, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=11, name="Canned Peas",         category="Canned Vegetables - Peas",        barcode="100000111011", quantity=200, unit="cans",    expiration_date=date(2026, 5, 25),  location_id=1, bank_id=1, created_by=2, modified_by=2),
        dict(item_id=12, name="Orange Juice",        category="Juice",                           barcode="100000111012", quantity=100, unit="bottles", expiration_date=date(2026, 12, 5),  location_id=2, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=13, name="Cheddar Cheese",      category="Cheese",                          barcode="100000111013", quantity=50,  unit="blocks",  expiration_date=date(2026, 11, 30), location_id=2, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=14, name="Yogurt",              category="Yogurt",                          barcode="100000111014", quantity=80,  unit="cups",    expiration_date=date(2026, 11, 20), location_id=2, bank_id=1, created_by=2, modified_by=2),
        dict(item_id=15, name="Carrots",             category="Fresh Produce - Root Vegetables", barcode="100000111015", quantity=120, unit="kgs",     expiration_date=date(2026, 11, 10), location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=16, name="Potatoes",            category="Fresh Produce - Root Vegetables", barcode="100000111016", quantity=300, unit="kgs",     expiration_date=date(2026, 1, 15),  location_id=3, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=17, name="Onions",              category="Fresh Produce - Other Vegetables",barcode="100000111017", quantity=200, unit="kgs",     expiration_date=date(2026, 12, 10), location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=18, name="Ground Beef",         category="Meat - Ground Beef",              barcode="100000111018", quantity=60,  unit="packs",   expiration_date=date(2026, 11, 20), location_id=4, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=19, name="Turkey",              category="Meat - Turkey",                  barcode="100000111019", quantity=40,  unit="packs",   expiration_date=date(2026, 12, 1),  location_id=4, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=20, name="Frozen Pizza",        category="Frozen Meals",                    barcode="100000111020", quantity=50,  unit="units",   expiration_date=date(2026, 1,  1),  location_id=2, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=21, name="Frozen Vegetables",   category="Frozen Vegetables",               barcode="100000111021", quantity=120, unit="packs",   expiration_date=date(2026, 12, 15), location_id=2, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=22, name="Spaghetti",           category="Pasta - Long",                    barcode="100000111022", quantity=200, unit="boxes",   expiration_date=date(2027, 2, 10),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=23, name="Mac & Cheese",        category="Pasta - Mac & Cheese Kit",        barcode="100000111023", quantity=150, unit="boxes",   expiration_date=date(2027, 3,  1),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=24, name="Tomato Paste",        category="Canned Vegetables - Tomatoes",    barcode="100000111024", quantity=180, unit="cans",    expiration_date=date(2026, 6, 15),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=25, name="Canned Tuna",         category="Canned Fish",                     barcode="100000111025", quantity=100, unit="cans",    expiration_date=date(2026, 5, 20),  location_id=1, bank_id=1, created_by=2, modified_by=2),
        dict(item_id=26, name="Cereal",              category="Cereal - Ready to Eat",           barcode="100000111026", quantity=220, unit="boxes",   expiration_date=date(2026, 8,  1),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=27, name="Granola Bars",        category="Granola Bars / Energy Bars",      barcode="100000111027", quantity=150, unit="boxes",   expiration_date=date(2026, 7, 15),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=28, name="Crackers",            category="Crackers",                        barcode="100000111028", quantity=200, unit="boxes",   expiration_date=date(2026, 9,  1),  location_id=3, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=29, name="Peas",                category="Fresh Produce - Other Vegetables",barcode="100000111029", quantity=180, unit="kgs",     expiration_date=date(2026, 12, 20), location_id=1, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=30, name="Corn",                category="Fresh Produce - Other Vegetables",barcode="100000111030", quantity=200, unit="kgs",     expiration_date=date(2026, 12, 25), location_id=1, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=31, name="Strawberries",        category="Fresh Produce - Berries",         barcode="100000111031", quantity=120, unit="kgs",     expiration_date=date(2026, 11, 15), location_id=1, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=32, name="Blueberries",         category="Fresh Produce - Berries",         barcode="100000111032", quantity=100, unit="kgs",     expiration_date=date(2026, 11, 20), location_id=1, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=33, name="Bananas",             category="Fresh Produce - Other Fruit",     barcode="100000111033", quantity=250, unit="kgs",     expiration_date=date(2026, 11, 30), location_id=1, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=34, name="Oranges",             category="Fresh Produce - Citrus",          barcode="100000111034", quantity=180, unit="kgs",     expiration_date=date(2026, 12, 5),  location_id=1, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=35, name="Water",               category="Water",                           barcode="100000111035", quantity=300, unit="bottles", expiration_date=date(2027, 1,  1),  location_id=2, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=36, name="Ice Cream",           category="Frozen Desserts",                 barcode="100000111036", quantity=50,  unit="boxes",   expiration_date=date(2026, 2,  1),  location_id=2, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=37, name="Frozen Peas",         category="Frozen Vegetables",               barcode="100000111037", quantity=150, unit="packs",   expiration_date=date(2026, 12, 15), location_id=2, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=38, name="Frozen Corn",         category="Frozen Vegetables",               barcode="100000111038", quantity=200, unit="packs",   expiration_date=date(2026, 12, 20), location_id=2, bank_id=1, created_by=1, modified_by=2),
        dict(item_id=39, name="Butter",              category="Butter / Margarine",              barcode="100000111039", quantity=70,  unit="blocks",  expiration_date=date(2026, 12, 5),  location_id=4, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=40, name="Margarine",           category="Butter / Margarine",              barcode="100000111040", quantity=80,  unit="blocks",  expiration_date=date(2026, 12, 10), location_id=4, bank_id=1, created_by=2, modified_by=1),
        dict(item_id=41, name="Tomatoes",            category="Fresh Produce - Other Vegetables",barcode="100000111041", quantity=200, unit="kgs",     expiration_date=date(2026, 12, 15), location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=42, name="Lettuce",             category="Fresh Produce - Leafy Greens",    barcode="100000111042", quantity=150, unit="kgs",     expiration_date=date(2026, 12, 20), location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=43, name="Cucumber",            category="Fresh Produce - Other Vegetables",barcode="100000111043", quantity=100, unit="kgs",     expiration_date=date(2026, 12, 25), location_id=3, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=44, name="Broccoli",            category="Fresh Produce - Other Vegetables",barcode="100000111044", quantity=120, unit="kgs",     expiration_date=date(2026, 12, 30), location_id=3, bank_id=1, created_by=3, modified_by=2),
        dict(item_id=45, name="Spinach",             category="Fresh Produce - Leafy Greens",    barcode="100000111045", quantity=90,  unit="kgs",     expiration_date=date(2026, 12, 15), location_id=3, bank_id=1, created_by=1, modified_by=3),
        dict(item_id=46, name="Mixed Vegetables",    category="Frozen Vegetables",               barcode="100000111046", quantity=200, unit="packs",   expiration_date=date(2026, 1, 15),  location_id=2, bank_id=1, created_by=1, modified_by=2),
    ]

    for i in items:
        item = InventoryItem(
            item_id=i["item_id"],
            name=i["name"],
            category=i["category"],
            category_notes=None,
            barcode=i["barcode"],
            quantity=i["quantity"],
            unit=i["unit"],
            expiration_date=i["expiration_date"],
            location_id=i["location_id"],
            bank_id=i["bank_id"],
            created_by=i["created_by"],
            modified_by=i["modified_by"],
        )
        db.merge(item)
    db.commit()
    print("Inventory seeded.")


def main():
    # seed_roles()
    # seed_food_banks()
    # # seed_users() skipped — users are already seeded by the auth migration (e5f6g7h8i9j0)
    # seed_locations()
    seed_inventory()
    print("\nAll data seeded successfully!")
    print("\nTest user credentials (all passwords: password123):")
    print("  haley@hamfoodbank.ca")
    print("  tony@hamfoodbank.ca")
    print("  alexr@hamfoodbank.ca")
    print("\nRun seed_admin_user.py to create an admin user.")
    db.close()


if __name__ == "__main__":
    main()
