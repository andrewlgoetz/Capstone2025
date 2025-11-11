from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.schemas.inventory_schema import InventoryCreate, InventoryRead

router = APIRouter(prefix="/inventory", tags=["Inventory"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# TODO: Replace this later with real auth (JWT / session)
class CurrentUser(BaseModel):
    user_id: int
    bank_id: int

def get_current_user() -> CurrentUser:
    # TODO: read session and load user from DB
    # For now, return a fixed user that exists in your DB
    return CurrentUser(user_id=1, bank_id=1)

@router.post("/add", response_model=InventoryRead)
def add_item(item: InventoryCreate,
             db: Session = Depends(get_db),
             current_user: CurrentUser = Depends(get_current_user)):
    data = item.model_dump()
    data["bank_id"] = current_user.bank_id
    data["created_by"] = current_user.user_id
    data["modified_by"] = current_user.user_id
    new_item = InventoryItem(**data)
    try:
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
    except IntegrityError as e:
        db.rollback()
        err = str(getattr(e, "orig", e))   # << show actual DB reason
        print("IntegrityError:", err)
    return new_item

@router.get("/all", response_model=list[InventoryRead])
def list_items(db: Session = Depends(get_db),
               current_user: CurrentUser = Depends(get_current_user)):
    return db.query(InventoryItem).all()

    # TODO: Once auth is implemented, return items belonging to the user's bank only
    # return (
    #     db.query(InventoryItem)
    #       .filter(InventoryItem.bank_id == current_user.bank_id)
    #       .order_by(InventoryItem.item_id.desc())
    #       .all()
    # )

@router.get("/{item_id}", response_model=InventoryRead)
def get_item(item_id: int,
             db: Session = Depends(get_db),
             current_user: CurrentUser = Depends(get_current_user)):
    item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    
    # TODO: Once auth is implemented, ensure the item belongs to the user's bank
    # item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id,
    #                                       InventoryItem.bank_id == current_user.bank_id).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.delete("/{item_id}")
def delete_item(item_id: int,
                db: Session = Depends(get_db),
                current_user: CurrentUser = Depends(get_current_user)):
    item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    
    # TODO: Once auth is implemented, ensure the deleted item belongs to the user's bank
    # item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id,
    #                                       InventoryItem.bank_id == current_user.bank_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}
