from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class BarcodeProduct(Base):
    """Persistent barcode-to-product mapping.

    Stores product metadata for barcodes that were manually entered by users
    so that future scans of the same barcode auto-fill the item details.
    """

    __tablename__ = "barcode_products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
