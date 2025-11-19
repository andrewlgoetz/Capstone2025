# This simulates barcode lookup.
# Later you can connect to an external product API (like OpenFoodFacts).
from datetime import datetime, date, timedelta
from app.schemas.inventory_schema import *
from app.db.session import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



def lookup_barcode(barcode: str):
    return dummy_barcodes.get(barcode, None)


# must comply with BarcodeInfo Model
dummy_barcodes = {
    # Food item
    "0123456789123": {
        "item_id": 1,
        "bank_id": 1,
        "name": "Canned Beans",
        "category": "Food",
        "barcode": "0123456789123",
        "quantity": 25,
        "unit": "pcs",
        "expiration_date": date.today() + timedelta(days=180),
        "location_id": 101,
        "date_added": datetime.now() - timedelta(days=10),
        "last_modified": datetime.now(),
        "created_by": 5,
        "modified_by": 5
    },

    # Clothing item
    "9876543210987": {
        "item_id": 2,
        "bank_id": 1,
        "name": "T-Shirt",
        "category": "Clothing",
        "barcode": "9876543210987",
        "quantity": 60,
        "unit": "pcs",
        "expiration_date": None,  # not perishable
        "location_id": 102,
        "date_added": datetime.now() - timedelta(days=3),
        "last_modified": datetime.now(),
        "created_by": 2,
        "modified_by": 4
    },

    # Household supply
    "5556667778889": {
        "item_id": 3,
        "bank_id": 2,
        "name": "Dish Soap",
        "category": "Household Supplies",
        "barcode": "5556667778889",
        "quantity": 40,
        "unit": "bottle",
        "expiration_date": date.today() + timedelta(days=365),
        "location_id": 201,
        "date_added": datetime.now() - timedelta(days=7),
        "last_modified": datetime.now(),
        "created_by": 3,
        "modified_by": 3
    },

    # Fresh produce
    "1112223334445": {
        "item_id": 4,
        "bank_id": 2,
        "name": "Fresh Apples",
        "category": "Produce",
        "barcode": "1112223334445",
        "quantity": 120,
        "unit": "kg",
        "expiration_date": date.today() + timedelta(days=10),
        "location_id": 202,
        "date_added": datetime.now() - timedelta(days=1),
        "last_modified": datetime.now(),
        "created_by": 1,
        "modified_by": 1
    }
}