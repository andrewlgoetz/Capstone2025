"""add_other_category_and_notes_field

Revision ID: 9178422f9ce0
Revises: 10828d31e908
Create Date: 2026-02-04 14:44:10.921591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9178422f9ce0'
down_revision: Union[str, Sequence[str], None] = '10828d31e908'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add "Other" category
    from sqlalchemy import table, column, String, Integer, Boolean
    categories_table = table('categories',
        column('name', String),
        column('display_order', Integer),
        column('is_active', Boolean)
    )

    op.execute(
        categories_table.insert().values(
            name="Other",
            display_order=11,
            is_active=True
        )
    )

    # Add category_notes field to inventory table
    op.add_column('inventory', sa.Column('category_notes', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove category_notes field
    op.drop_column('inventory', 'category_notes')

    # Remove "Other" category
    op.execute("DELETE FROM categories WHERE name = 'Other'")
