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

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_categories_category_id'), table_name='categories')
    op.drop_table('categories')
