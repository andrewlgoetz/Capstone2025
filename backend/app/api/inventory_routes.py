from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.schemas.inventory_schema import InventoryCreate, InventoryRead
from sqlalchemy import desc
from sqlalchemy.orm import joinedload
from app.models.location import Location

router = APIRouter(prefix="/inventory", tags=["Inventory"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/add", response_model=InventoryRead)
def add_item(item: InventoryCreate, db: Session = Depends(get_db)):
    new_item = InventoryItem(**item.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

from app.models.inventory import InventoryItem
from app.models.location import Location

@router.get("/all")
def get_inventory(db: Session = Depends(get_db)):
    results = (
        db.query(
            InventoryItem.item_id,
            InventoryItem.name,
            InventoryItem.category,
            InventoryItem.quantity,
            InventoryItem.expiration_date,
            Location.name.label("location_name"),
            Location.address.label("location_address"),
            Location.notes.label("location_notes"),
        )
        .outerjoin(Location, InventoryItem.location_id == Location.location_id)
        .all()
    )

    return [
        {
            "item_id": r.item_id,
            "name": r.name,
            "category": r.category,
            "quantity": r.quantity,
            "expiration_date": r.expiration_date,
            "location_name": r.location_name,
            "location_address": r.location_address,
            "location_notes": r.location_notes,
        }
        for r in results
    ]

@router.get("/{item_id}", response_model=InventoryRead)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}

@router.get("/inventory/topitems")
def get_top_items(db: Session = Depends(get_db)):
    # Hardcoded values for bank_id and limit
    bank_id = 1
    limit = 10

    items = db.query(InventoryItem)\
              .filter(InventoryItem.bank_id == bank_id)\
              .order_by(desc(InventoryItem.quantity))\
              .limit(limit)\
              .all()

    return items
