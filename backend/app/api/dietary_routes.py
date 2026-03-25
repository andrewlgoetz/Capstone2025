from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.dietary_restriction import DietaryRestriction
from app.models.activity_log import ActivityLog, ActivityAction
from app.models.user import User
from app.schemas.dietary_restriction_schema import DietaryRestrictionCreate, DietaryRestrictionRead, DietaryRestrictionUpdate
from app.dependencies import get_db, get_current_active_user
from app.services.permission_service import Permission, require_permission

router = APIRouter(prefix="/dietary-restrictions", tags=["Dietary Restrictions"])


@router.get("/", response_model=list[DietaryRestrictionRead])
def list_dietary_restrictions(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    query = db.query(DietaryRestriction)
    if not include_inactive:
        query = query.filter(DietaryRestriction.is_active == True)
    return query.order_by(DietaryRestriction.is_preset.desc(), DietaryRestriction.name).all()


@router.post("/", response_model=DietaryRestrictionRead)
def create_dietary_restriction(
    restriction: DietaryRestrictionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DIETARY_CREATE)),
):
    try:
        db_restriction = DietaryRestriction(
            name=restriction.name,
            color=restriction.color,
            is_preset=False,
        )
        db.add(db_restriction)
        db.flush()

        log = ActivityLog(
            user_id=current_user.user_id,
            action=ActivityAction.CREATE,
            entity_type="dietary_restriction",
            entity_id=db_restriction.id,
            item_name=db_restriction.name,
            details=f"Created dietary restriction '{db_restriction.name}'",
        )
        db.add(log)
        db.commit()
        db.refresh(db_restriction)
        return db_restriction
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A dietary restriction with this name already exists")


@router.put("/{restriction_id}", response_model=DietaryRestrictionRead)
def update_dietary_restriction(
    restriction_id: int,
    restriction: DietaryRestrictionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DIETARY_EDIT)),
):
    db_restriction = db.query(DietaryRestriction).filter(DietaryRestriction.id == restriction_id).first()
    if not db_restriction:
        raise HTTPException(status_code=404, detail="Dietary restriction not found")

    # Preset names cannot be changed
    update_data = restriction.model_dump(exclude_unset=True)
    if db_restriction.is_preset and "name" in update_data:
        del update_data["name"]

    try:
        for field, value in update_data.items():
            setattr(db_restriction, field, value)

        log = ActivityLog(
            user_id=current_user.user_id,
            action=ActivityAction.UPDATE,
            entity_type="dietary_restriction",
            entity_id=restriction_id,
            item_name=db_restriction.name,
            details=f"Updated dietary restriction '{db_restriction.name}'",
        )
        db.add(log)
        db.commit()
        db.refresh(db_restriction)
        return db_restriction
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A dietary restriction with this name already exists")


@router.delete("/{restriction_id}")
def deactivate_dietary_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DIETARY_EDIT)),
):
    db_restriction = db.query(DietaryRestriction).filter(DietaryRestriction.id == restriction_id).first()
    if not db_restriction:
        raise HTTPException(status_code=404, detail="Dietary restriction not found")
    if db_restriction.is_preset:
        raise HTTPException(status_code=400, detail="Preset dietary restrictions cannot be deactivated")

    db_restriction.is_active = False
    log = ActivityLog(
        user_id=current_user.user_id,
        action=ActivityAction.UPDATE,
        entity_type="dietary_restriction",
        entity_id=restriction_id,
        item_name=db_restriction.name,
        details=f"Deactivated dietary restriction '{db_restriction.name}'",
    )
    db.add(log)
    db.commit()
    return {"message": "Dietary restriction deactivated successfully"}


@router.post("/{restriction_id}/reactivate", response_model=DietaryRestrictionRead)
def reactivate_dietary_restriction(
    restriction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DIETARY_EDIT)),
):
    db_restriction = db.query(DietaryRestriction).filter(DietaryRestriction.id == restriction_id).first()
    if not db_restriction:
        raise HTTPException(status_code=404, detail="Dietary restriction not found")

    db_restriction.is_active = True
    log = ActivityLog(
        user_id=current_user.user_id,
        action=ActivityAction.UPDATE,
        entity_type="dietary_restriction",
        entity_id=restriction_id,
        item_name=db_restriction.name,
        details=f"Reactivated dietary restriction '{db_restriction.name}'",
    )
    db.add(log)
    db.commit()
    db.refresh(db_restriction)
    return db_restriction
