from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.models.user import User
from app.schemas.inventory_schema import InventoryCreate, InventoryRead, InventoryUpdate
import app.services.barcode_service as barcode_service
import app.services.inventory_service as inventory_service
from app.models.location import Location
from app.dependencies import get_db
from app.services.permission_service import Permission, require_permission

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# add a new item
@router.post("/add", response_model=InventoryRead)
def add_item(
    item: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_CREATE))
):
    # encapsulate this logic b/c its reused
    new_item = inventory_service.add_item(item, db)
    return new_item

@router.put("/{item_id}", response_model=InventoryRead)
def update_item(
    item_id: int,
    item: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_EDIT))
):
    return inventory_service.update_item(item_id, item, db)

@router.get("/allwithlocation")
def get_inventory(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
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
        .filter(InventoryItem.bank_id == current_user.bank_id)
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

@router.get("/all", response_model=list[InventoryRead])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
    return (
        db.query(InventoryItem)
        .filter(InventoryItem.bank_id == current_user.bank_id)
        .all()
    )

@router.get("/{item_id}", response_model=InventoryRead)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_VIEW))
):
    item = db.query(InventoryItem).filter(
        InventoryItem.item_id == item_id,
        InventoryItem.bank_id == current_user.bank_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.INVENTORY_DELETE))
):
    item = db.query(InventoryItem).filter(
        InventoryItem.item_id == item_id,
        InventoryItem.bank_id == current_user.bank_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}
