"""add_categories_table

Revision ID: 80506dc516f8
Revises: 5a4ea0d991d5
Create Date: 2026-02-04 12:15:51.025135

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80506dc516f8'
down_revision: Union[str, Sequence[str], None] = '5a4ea0d991d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create categories table
    op.create_table('categories',
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('category_id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_categories_category_id'), 'categories', ['category_id'], unique=False)

    # Seed with nonprofit categories
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
    op.drop_index(op.f('ix_categories_category_id'), table_name='categories')
    op.drop_table('categories')
