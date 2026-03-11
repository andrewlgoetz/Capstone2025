"""add barcode_products table

Revision ID: e1f2a3b4c5d6
Revises: 5a4ea0d991d5
Create Date: 2026-03-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = '5a4ea0d991d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create barcode_products table for persistent barcode -> product mappings."""
    op.create_table(
        'barcode_products',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('barcode', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_barcode_products_id'), 'barcode_products', ['id'], unique=False)
    op.create_index(op.f('ix_barcode_products_barcode'), 'barcode_products', ['barcode'], unique=True)


def downgrade() -> None:
    """Drop barcode_products table."""
    op.drop_index(op.f('ix_barcode_products_barcode'), table_name='barcode_products')
    op.drop_index(op.f('ix_barcode_products_id'), table_name='barcode_products')
    op.drop_table('barcode_products')
