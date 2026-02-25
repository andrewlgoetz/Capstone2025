"""update_categories_to_original_format

Revision ID: 10828d31e908
Revises: 80506dc516f8
Create Date: 2026-02-04 14:24:29.106799

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10828d31e908'
down_revision: Union[str, Sequence[str], None] = '80506dc516f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Delete all existing categories
    op.execute("DELETE FROM categories")

    # Reseed with original category format
    categories = [
        {"name": "Canned Goods", "display_order": 1},
        {"name": "Snacks", "display_order": 2},
        {"name": "Spreads", "display_order": 3},
        {"name": "Frozen", "display_order": 4},
        {"name": "Meat", "display_order": 5},
        {"name": "Grains", "display_order": 6},
        {"name": "Refrigerated", "display_order": 7},
        {"name": "Produce", "display_order": 8},
        {"name": "Beverages", "display_order": 9},
        {"name": "Dairy", "display_order": 10},
    ]

    # Insert categories
    from sqlalchemy import table, column, String, Integer, Boolean
    categories_table = table('categories',
        column('name', String),
        column('display_order', Integer),
        column('is_active', Boolean)
    )

    for cat in categories:
        op.execute(
            categories_table.insert().values(
                name=cat["name"],
                display_order=cat["display_order"],
                is_active=True
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Restore previous categories
    op.execute("DELETE FROM categories")

    categories = [
        {"name": "Canned & Packaged", "display_order": 1},
        {"name": "Fresh Produce", "display_order": 2},
        {"name": "Dairy & Eggs", "display_order": 3},
        {"name": "Proteins & Meat", "display_order": 4},
        {"name": "Grains & Pasta", "display_order": 5},
        {"name": "Condiments & Oils", "display_order": 6},
        {"name": "Beverages", "display_order": 7},
        {"name": "Other", "display_order": 8},
    ]

    from sqlalchemy import table, column, String, Integer, Boolean
    categories_table = table('categories',
        column('name', String),
        column('display_order', Integer),
        column('is_active', Boolean)
    )

    for cat in categories:
        op.execute(
            categories_table.insert().values(
                name=cat["name"],
                display_order=cat["display_order"],
                is_active=True
            )
        )
