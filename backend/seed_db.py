import csv
from datetime import datetime
from app.db.session import SessionLocal
from app.models.food_banks import FoodBank
from app.models.role import Role
from app.models.user import User
from app.models.location import Location
from app.models.inventory import InventoryItem

# Create a database session
db = SessionLocal()

def seed_roles(csv_path="data/roles.csv"):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            role = Role(
                role_id=int(row["role_id"]),
                name=row["name"]
            )
            db.merge(role)  # merge avoids duplicates
    db.commit()
    print("Roles seeded.")

def seed_food_banks(csv_path="data/food_banks.csv"):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            bank = FoodBank(
                bank_id=int(row["bank_id"]),
                name=row["name"],
                address=row.get("address")
            )
            db.merge(bank)
    db.commit()
    print("Food banks seeded.")

def seed_users(csv_path="data/users.csv"):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            user = User(
                user_id=int(row["user_id"]),
                name=row["name"],
                email=row["email"],
                password_hash=row["password_hash"],
                role_id=int(row["role_id"]) if row.get("role_id") else None,
                bank_id=int(row["bank_id"])
            )
            db.merge(user)
    db.commit()
    print("Users seeded.")

def seed_locations(csv_path="data/locations.csv"):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            location = Location(
                location_id=int(row["location_id"]),
                name=row["name"],
                address=row.get("address"),
                bank_id=int(row["bank_id"]),
                notes=row.get("notes")
            )
            db.merge(location)
    db.commit()
    print("Locations seeded.")

def seed_inventory(csv_path="data/inventory.csv"):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Parse datetime fields
            date_added = datetime.fromisoformat(row["date_added"]) if row.get("date_added") else None
            last_modified = datetime.fromisoformat(row["last_modified"]) if row.get("last_modified") else None

            item = InventoryItem(
                item_id=int(row["item_id"]),
                name=row["name"],
                category=row.get("category"),
                barcode=row.get("barcode"),
                quantity=int(row["quantity"]),
                unit=row.get("unit"),
                expiration_date=row.get("expiration_date"),
                location_id=int(row["location_id"]) if row.get("location_id") else None,
                date_added=date_added,
                last_modified=last_modified,
                bank_id=int(row["bank_id"]),
                created_by=int(row["created_by"]) if row.get("created_by") else None,
                modified_by=int(row["modified_by"]) if row.get("modified_by") else None
            )
            db.merge(item)
    db.commit()
    print("Inventory seeded.")

def main():
    seed_roles()
    seed_food_banks()
    seed_users()
    seed_locations()
    seed_inventory()
    print("All data seeded successfully!")

if __name__ == "__main__":
    main()
