from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.schemas.inventory_schema import InventoryCreate, InventoryRead
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status


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
    pass
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

    data = item.dict()
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
