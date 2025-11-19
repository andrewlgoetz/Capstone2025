from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
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
    print(f"[inventory_service.add_item] normalized barcode: {code}")
    #does it exist?
    if code:
        dup = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
        print(f"[inventory_service.add_item] duplicate check result: {bool(dup)}")
        if dup:
            # TODO return a message here instead?
            raise HTTPException(status_code=409, detail=f"Barcode already exists on another item (item_id={dup.item_id}).")

    data = item.model_dump()
    data["bank_id"] = bank_id
    data["last_modified"] = datetime.now()
    if "barcode" in data:
        data["barcode"] = code

    new_item = InventoryItem(
    **data,
)
    
    try:
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
    except IntegrityError:
        db.rollback()
        # covers race against unique(barcode) or other constraints
        import traceback
        tb = traceback.format_exc()
        print(f"[inventory_service.add_item] IntegrityError: {tb}")

        # Try to recover from out-of-sync primary key sequence by syncing it and retrying once
        try:
            print("[inventory_service.add_item] Attempting to sync inventory_item_id_seq and retry insert")
            db.execute("SELECT setval('inventory_item_id_seq', COALESCE((SELECT MAX(item_id) FROM inventory), 1));")
            db.commit()
            # create a fresh ORM object and retry insert
            retry_item = InventoryItem(**data)
            db.add(retry_item)
            db.commit()
            db.refresh(retry_item)
            return retry_item
        except Exception as retry_err:
            db.rollback()
            print(f"[inventory_service.add_item] Retry failed: {retry_err}")
            raise HTTPException(status_code=409, detail="Constraint violation (likely duplicate barcode or PK).")

    return new_item


def update_item(item_id: int, item: InventoryUpdate, db: Session) -> InventoryItem:
    
    # Get existing DB row
    db_item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_qty = db_item.quantity
    old_loc = db_item.location_id

    # Only include fields actually sent from the client
    data = item.model_dump(exclude_unset=True)

    # pull out movement-only fields so they are NOT applied to Inventory
    movement_type = data.pop("movement_type", None)
    movement_reason = data.pop("movement_reason", None)

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

    new_qty = db_item.quantity
    new_loc = db_item.location_id

    # Determine what changed (quantity/location)
    qty_delta = None
    if new_qty is not None and new_qty != old_qty:
        qty_delta = new_qty - old_qty  # positive if increased, negative if decreased
    
    loc_changed = new_loc is not None and new_loc != old_loc

    # If relevant, create an InventoryMovement record
    should_create_movement = (
        (qty_delta is not None and qty_delta < 0)
        or loc_changed
    )

    if should_create_movement:
        if movement_type is None:
            raise HTTPException(
                status_code=400,
                detail="movement_type is required when quantity decreases or location changes",
            )

        movement = InventoryMovement(
            item_id=db_item.item_id,
            quantity_change=qty_delta if qty_delta is not None else 0,
            movement_type=movement_type,
            reason=movement_reason,
            from_location_id=old_loc,
            to_location_id=new_loc if loc_changed else None,
        )
        db.add(movement)

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


def get_item_by_barcode(barcode: str, db: Session) -> InventoryItem:
    #call barcode service for 3rd party if required (required when new scan we want the image)
    code = normalize_barcode(barcode)
    if not code:
        raise HTTPException(status_code=400, detail="barcode is required")

    db_item = (
        db.query(InventoryItem)
        .filter(InventoryItem.barcode == code)
        .first()
    )

    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

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