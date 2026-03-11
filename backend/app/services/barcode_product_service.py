"""Service layer for the barcode_products mapping table.

Provides get_by_barcode and upsert helpers used by the scan-in flow and
the product-mapping endpoint.
"""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.barcode_product import BarcodeProduct
from app.schemas.inventory_schema import BarcodeProductCreate
from app.services.inventory_service import normalize_barcode


def get_by_barcode(barcode: str, db: Session):
    """Return the saved BarcodeProduct for *barcode*, or None."""
    code = normalize_barcode(barcode)
    if not code:
        return None
    return db.query(BarcodeProduct).filter(BarcodeProduct.barcode == code).first()


def upsert(data: BarcodeProductCreate, db: Session) -> BarcodeProduct:
    """Save or update a barcode -> product mapping.

    If the barcode already exists the name/category/image_url fields are updated
    with the new values and the existing row is returned.
    Barcode is normalized before persisting.
    """
    code = normalize_barcode(data.barcode)
    if not code:
        raise ValueError("barcode is required")

    existing = db.query(BarcodeProduct).filter(BarcodeProduct.barcode == code).first()

    if existing:
        existing.name = data.name
        existing.category = data.category
        existing.image_url = data.image_url
        try:
            db.commit()
            db.refresh(existing)
        except IntegrityError:
            db.rollback()
            raise
        return existing

    product = BarcodeProduct(
        barcode=code,
        name=data.name,
        category=data.category,
        image_url=data.image_url,
    )
    try:
        db.add(product)
        db.commit()
        db.refresh(product)
    except IntegrityError:
        # race condition: another request inserted the same barcode first
        db.rollback()
        existing = db.query(BarcodeProduct).filter(BarcodeProduct.barcode == code).first()
        if existing:
            return existing
        raise

    return product
