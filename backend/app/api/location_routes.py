from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.models.location import Location
from app.models.user_location import UserLocation
from app.models.user import User
from app.dependencies import get_db, get_current_active_user, require_admin
from app.services import auth_service

router = APIRouter(prefix="/locations", tags=["Locations"])


# --- Schemas ---

class LocationCreate(BaseModel):
    name: str
    address: Optional[str] = None
    notes: Optional[str] = None

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class LocationRead(BaseModel):
    location_id: int
    bank_id: int
    name: str
    address: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# --- Helpers ---

def get_user_assigned_location_ids(user_id: int, db: Session) -> list[int]:
    rows = db.query(UserLocation.location_id).filter(UserLocation.user_id == user_id).all()
    return [r.location_id for r in rows]


# --- Endpoints ---

@router.get("", response_model=List[LocationRead])
def get_my_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get locations accessible to the current user.
    Admins see all bank locations; others see only assigned locations.
    """
    is_admin = auth_service.is_admin(current_user, db)

    if is_admin:
        return (
            db.query(Location)
            .filter(Location.bank_id == current_user.bank_id)
            .order_by(Location.name)
            .all()
        )

    assigned_ids = get_user_assigned_location_ids(current_user.user_id, db)
    if not assigned_ids:
        return []

    return (
        db.query(Location)
        .filter(Location.location_id.in_(assigned_ids), Location.bank_id == current_user.bank_id)
        .order_by(Location.name)
        .all()
    )


@router.get("/all", response_model=List[LocationRead])
def get_all_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: get ALL locations for the bank (for admin dropdowns)."""
    return (
        db.query(Location)
        .filter(Location.bank_id == current_user.bank_id)
        .order_by(Location.name)
        .all()
    )


@router.post("", response_model=LocationRead, status_code=201)
def create_location(
    data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: create a new location for the bank."""
    loc = Location(
        bank_id=current_user.bank_id,
        name=data.name,
        address=data.address,
        notes=data.notes,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc


@router.put("/{location_id}", response_model=LocationRead)
def update_location(
    location_id: int,
    data: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: update a location."""
    loc = db.query(Location).filter(
        Location.location_id == location_id,
        Location.bank_id == current_user.bank_id,
    ).first()

    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(loc, field, value)

    db.commit()
    db.refresh(loc)
    return loc


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: delete a location."""
    loc = db.query(Location).filter(
        Location.location_id == location_id,
        Location.bank_id == current_user.bank_id,
    ).first()

    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    db.delete(loc)
    db.commit()
    return {"message": "Location deleted successfully"}
