"""add dietary restrictions tables

Revision ID: h8i9j0k1l2m3
Revises: merge_9424a675_b1f2c3d
Create Date: 2026-03-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, Sequence[str], None] = 'merge_9424a675_b1f2c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dietary_restrictions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False, unique=True),
        sa.Column('is_preset', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('preset_type', sa.String(), nullable=True),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'item_dietary_restrictions',
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('inventory.item_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('dietary_restriction_id', sa.Integer(), sa.ForeignKey('dietary_restrictions.id', ondelete='CASCADE'), primary_key=True),
    )

    # Seed preset restrictions
    op.execute("""
        INSERT INTO dietary_restrictions (name, is_preset, preset_type, color, is_active)
        VALUES
            ('Halal', true, 'halal', null, true),
            ('Kosher', true, 'kosher', null, true)
    """)


def downgrade() -> None:
    op.drop_table('item_dietary_restrictions')
    op.drop_table('dietary_restrictions')
