from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.schemas.inventory_schema import InventoryCreate, InventoryRead, InventoryUpdate
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_barcode(code):
    if code is None:
        return None
    code = code.strip().replace(" ", "")
    return code or None


def default_bank_id(db):
    # TEMP: until auth/multi-bank is implemented
    return 1

    #TODO LATER: how will bankid be stored, will changing locations change bank id? 

        # bank = db.query(FoodBank).first()
        # if not bank:
        #     raise HTTPException(status_code=400, detail="No food bank found in the database.")
        # return bank.bank_id


def add_item(item: InventoryCreate, db: Session = Depends(get_db)):
    # If InventoryCreate includes barcode, protect it
    bank_id = getattr(item, "bank_id", None) or default_bank_id(db)

    code = normalize_barcode(getattr(item, "barcode", None))
    #does it exist?
    if code:
        dup = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
        if dup:
            # TODO return a message here instead?
            raise HTTPException(status_code=409, detail="Barcode already exists on another item.")

    data = item.model_dump()
    data["bank_id"] = bank_id
    if "barcode" in data:
        data["barcode"] = code

    new_item = InventoryItem(**data)
    
    try:
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
    except IntegrityError:
        db.rollback()
        # covers race against unique(barcode) or other constraints
        raise HTTPException(status_code=409, detail="Constraint violation (likely duplicate barcode).")

    return new_item


def update_item(item_id: int, item: InventoryUpdate, db: Session) -> InventoryItem:
    
    # Get existing DB row
    db_item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Only include fields actually sent from the client
    data = item.model_dump(exclude_unset=True)

    # If barcode present, normalize + uniqueness check
    if "barcode" in data:
        code = normalize_barcode(data["barcode"])
        if code:
            dup = (
                db.query(InventoryItem)
                .filter(
                    InventoryItem.barcode == code,
                    InventoryItem.item_id != item_id,
                )
                .first()
            )
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail="Barcode already exists on another item.",
                )
        data["barcode"] = code

    # Apply changes to the ORM object
    for field, value in data.items():
        setattr(db_item, field, value)

    db_item.last_modified = datetime.now()

    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Constraint violation (likely duplicate barcode).",
        )

    return db_item

def adjust_item_quantity(item_id: int, delta: int, db: Session) -> InventoryItem:
    # Load the existing item
    db_item = (
        db.query(InventoryItem)
        .filter(InventoryItem.item_id == item_id)
        .first()
    )
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    current_qty = db_item.quantity or 0
    new_qty = current_qty + delta

    if new_qty < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock: cannot adjust by {delta} from {current_qty}.",
        )

    # Reuse your update_item helper with absolute quantity
    updated = update_item(
        item_id=item_id,
        item=InventoryUpdate(quantity=new_qty),
        db=db,
    )
    return updated