from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.schemas.inventory_schema import InventoryCreate, InventoryRead
from sqlalchemy import desc

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

@router.get("/all", response_model=list[InventoryRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(InventoryItem).all()

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
