from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import SessionLocal
from app.models.category import Category
from app.schemas.category_schema import CategoryCreate, CategoryRead, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/", response_model=list[CategoryRead])
def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db)
):
    """List all categories. By default, only active categories are returned."""
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    return query.order_by(Category.display_order, Category.name).all()

@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """Get a specific category by ID."""
    category = db.query(Category).filter(Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.post("/", response_model=CategoryRead)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category."""
    try:
        db_category = Category(**category.model_dump())
        db.add(db_category)
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
    db: Session = Depends(get_db)
):
    """Update an existing category."""
    db_category = db.query(Category).filter(Category.category_id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    try:
        # Update only provided fields
        update_data = category.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_category, field, value)

        db.commit()
        db.refresh(db_category)
        return db_category
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Category with this name already exists")

@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Soft delete a category by marking it as inactive."""
    db_category = db.query(Category).filter(Category.category_id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Soft delete by marking as inactive
    db_category.is_active = False
    db.commit()
    return {"message": "Category deactivated successfully"}
