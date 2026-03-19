from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import SessionLocal
from app.models.category import Category
from app.models.activity_log import ActivityLog, ActivityAction
from app.models.user import User
from app.schemas.category_schema import CategoryCreate, CategoryRead, CategoryUpdate
from app.dependencies import get_db, get_current_active_user
from app.services.permission_service import Permission, require_permission, require_any_permission

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/", response_model=list[CategoryRead])
def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all categories. By default, only active categories are returned."""
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    return query.order_by(Category.display_order, Category.name).all()


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a specific category by ID."""
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryRead)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.CATEGORY_CREATE)),
):
    """Create a new category."""
    try:
        db_category = Category(**category.model_dump())
        db.add(db_category)
        db.flush()

        log = ActivityLog(
            user_id=current_user.user_id,
            action=ActivityAction.CREATE,
            entity_type="category",
            entity_id=db_category.category_id,
            item_name=db_category.name,
            details=f"Created category '{db_category.name}'",
        )
        db.add(log)
        db.commit()
        db.refresh(db_category)
        return db_category
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category with this name already exists")


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    category: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.CATEGORY_EDIT)),
):
    """Update an existing category."""
    db_category = db.query(Category).filter(Category.category_id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    try:
        update_data = category.model_dump(exclude_unset=True)
        old_name = db_category.name
        for field, value in update_data.items():
            setattr(db_category, field, value)

        details = f"Renamed '{old_name}' → '{db_category.name}'" if "name" in update_data and update_data["name"] != old_name else f"Updated category '{old_name}'"
        log = ActivityLog(
            user_id=current_user.user_id,
            action=ActivityAction.UPDATE,
            entity_type="category",
            entity_id=category_id,
            item_name=db_category.name,
            details=details,
        )
        db.add(log)
        db.commit()
        db.refresh(db_category)
        return db_category
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category with this name already exists")


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.CATEGORY_EDIT)),
):
    """Soft delete a category by marking it as inactive."""
    db_category = db.query(Category).filter(Category.category_id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    db_category.is_active = False
    log = ActivityLog(
        user_id=current_user.user_id,
        action=ActivityAction.UPDATE,
        entity_type="category",
        entity_id=category_id,
        item_name=db_category.name,
        details=f"Deactivated category '{db_category.name}'",
    )
    db.add(log)
    db.commit()
    return {"message": "Category deactivated successfully"}


@router.post("/{category_id}/reactivate", response_model=CategoryRead)
def reactivate_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.CATEGORY_EDIT)),
):
    """Reactivate a previously deactivated category."""
    db_category = db.query(Category).filter(Category.category_id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    db_category.is_active = True
    log = ActivityLog(
        user_id=current_user.user_id,
        action=ActivityAction.UPDATE,
        entity_type="category",
        entity_id=category_id,
        item_name=db_category.name,
        details=f"Reactivated category '{db_category.name}'",
    )
    db.add(log)
    db.commit()
    db.refresh(db_category)
    return db_category
