from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.demand_session import SessionDemand
from app.models.demand_inventory import DemandInventory
from backend.app.schemas.demand_inventory_schema import DemandCreate, DemandRead
from sqlalchemy import desc
from sqlalchemy.orm import joinedload
from app.models.location import Location
from datetime import date

router = APIRouter(prefix="/demand_inventory", tags=["Demand_Inventory"])

def get_db():
    db = SessionDemand()
    try:
        yield db
    finally:
        db.close()

@router.post("/add", response_model=DemandRead)
def add_item(item: DemandCreate, db: Session = Depends(get_db)):
    new_item = DemandInventory(**item.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.get("/all")
def get_inventory(db: Session = Depends(get_db)):
    results = (
        db.query(
            DemandInventory.date,
            DemandInventory.store_id,
            DemandInventory.product_id,
            DemandInventory.category,
            DemandInventory.inventory_level,
            DemandInventory.units_sold,
            DemandInventory.units_ordered
        )
        .all()
    )

    return [
        {
            "date": r.date,
            "store_id": r.store_id,
            "product_id": r.product_id,
            "category": r.category,
            "inventory": r.inventory_level,
            "sold": r.units_sold,
            "ordered": r.units_ordered
        }
        for r in results
    ]

# get item: primary key = (date,store_id,product_id,category)
@router.get("/{date}/{store_id}/{product_id}/{category}", response_model=DemandRead)
def get_item(date: date, store_id: str, product_id: str, category: str, db: Session = Depends(get_db)):
    item = db.query(DemandInventory).filter(
                                     DemandInventory.date == date,
                                     DemandInventory.store_id == store_id,
                                     DemandInventory.product_id == product_id,
                                     DemandInventory.category == category
                                     ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.delete("/{date}/{store_id}/{product_id}/{category}")
def delete_item(date: date, store_id: str, product_id: str, category: str, db: Session = Depends(get_db)):
    item = db.query(DemandInventory).filter(
                                     DemandInventory.date == date,
                                     DemandInventory.store_id == store_id,
                                     DemandInventory.product_id == product_id,
                                     DemandInventory.category == category
                                     ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}

@router.get("/demand_inventory/topitems")
def get_top_items(db: Session = Depends(get_db)):
    # Hardcoded values for bank_id and limit
    store_id = 'S001'
    limit = 10

    items = db.query(DemandInventory)\
              .filter(DemandInventory.store_id == store_id)\
              .order_by(desc(DemandInventory.inventory_level))\
              .limit(limit)\
              .all()

    return items
