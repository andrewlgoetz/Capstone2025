from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.schemas.inventory_schema import InventoryCreate, InventoryRead, InventoryUpdate
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone


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


def add_item(item: InventoryCreate, db: Session = Depends(get_db), user_id: int = None):
    bank_id = getattr(item, "bank_id", None) or default_bank_id(db)
    code = normalize_barcode(getattr(item, "barcode", None))
    
    if code:
        dup = db.query(InventoryItem).filter(InventoryItem.barcode == code).first()
        if dup:
            raise HTTPException(status_code=409, detail=f"Barcode already exists on another item (item_id={dup.item_id}).")

    data = item.model_dump()
    data["bank_id"] = bank_id
    data["last_modified"] = datetime.now(timezone.utc)
    if "barcode" in data:
        data["barcode"] = code

    new_item = InventoryItem(**data)

    try:
        db.add(new_item)
        db.flush()  # Flush to get the item_id without committing yet

        # Create initial inventory movement if quantity > 0
        if new_item.quantity and new_item.quantity > 0:
            initial_movement = InventoryMovement(
                item_id=new_item.item_id,
                quantity_change=new_item.quantity,
                quantity_after=new_item.quantity,
                movement_type=MovementType.INBOUND,
                to_location_id=new_item.location_id,
                user_id=user_id
            )
            db.add(initial_movement)

        # Commit both item and movement together
        db.commit()
        db.refresh(new_item)
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig).lower() if hasattr(e, 'orig') else str(e).lower()

        # Check for specific constraint violations
        if 'barcode' in error_msg and ('unique' in error_msg or 'duplicate' in error_msg):
            raise HTTPException(
                status_code=409,
                detail=f"An item with barcode '{code}' already exists in the system. Please use a different barcode or update the existing item."
            )
        elif 'location' in error_msg and 'foreign key' in error_msg:
            raise HTTPException(
                status_code=400,
                detail="Invalid location specified. Please select a valid location from the list."
            )
        elif 'primary key' in error_msg or 'duplicate' in error_msg:
            raise HTTPException(
                status_code=409,
                detail="This item already exists in the database. Please try updating the existing item instead."
            )
        else:
            # Generic constraint violation message
            raise HTTPException(
                status_code=409,
                detail="Unable to add item due to a data conflict. Please check your input and try again."
            )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add item: {str(e)}")

    return new_item


def update_item(item_id: int, item: InventoryUpdate, db: Session, user_id: int = None) -> InventoryItem:
    db_item = db.query(InventoryItem).filter(InventoryItem.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_qty = db_item.quantity
    old_loc = db_item.location_id

    data = item.model_dump(exclude_unset=True)
    movement_type = data.pop("movement_type", None)
    movement_reason = data.pop("movement_reason", None)

    if "barcode" in data:
        code = normalize_barcode(data["barcode"])
        if code:
            dup = db.query(InventoryItem).filter(
                InventoryItem.barcode == code,
                InventoryItem.item_id != item_id,
            ).first()
            if dup:
                raise HTTPException(status_code=409, detail="Barcode already exists on another item.")
        data["barcode"] = code

    for field, value in data.items():
        setattr(db_item, field, value)

    db_item.last_modified = datetime.now(timezone.utc)

    new_qty = db_item.quantity
    new_loc = db_item.location_id

    qty_delta = None
    if new_qty is not None and new_qty != old_qty:
        qty_delta = new_qty - old_qty 
    
    loc_changed = new_loc is not None and new_loc != old_loc

    # --- UPDATED: Trigger on ANY quantity change (not just negative) ---
    should_create_movement = (
        (qty_delta is not None and qty_delta != 0)
        or loc_changed
    )

    if should_create_movement:
            actual_movement_type = movement_type or MovementType.ADJUSTMENT
            movement = InventoryMovement(
                item_id=db_item.item_id,
                quantity_change=qty_delta if qty_delta is not None else 0,
                quantity_after=new_qty,
                movement_type=actual_movement_type,
                reason=movement_reason,
                from_location_id=old_loc,
                to_location_id=new_loc if loc_changed else None,
                user_id=user_id # Add this
            )
            db.add(movement)

    try:
        db.commit()
        db.refresh(db_item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Constraint violation (likely duplicate barcode).")

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

def adjust_item_quantity(item_id: int, delta: int, db: Session, movement_type=None, user_id: int = None) -> InventoryItem:
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

    updated = update_item(
            item_id=item_id,
            item=InventoryUpdate(quantity=new_qty, movement_type=movement_type),
            db=db,
            user_id=user_id # Add this
        )
    return updated