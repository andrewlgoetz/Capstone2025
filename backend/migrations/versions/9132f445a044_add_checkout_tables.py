"""add checkout tables

Revision ID: 9132f445a044
Revises: a1b2c3d4e5f6
Create Date: 2026-03-21 22:48:55.478968

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9132f445a044'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'checkout',
        sa.Column('checkout_id', sa.Integer(), nullable=False),
        sa.Column('served_by_user_id', sa.Integer(), nullable=False),
        sa.Column('patron_id', sa.String(), nullable=True),
        sa.Column('patron_type', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['served_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('checkout_id')
    )
    op.create_index(op.f('ix_checkout_checkout_id'), 'checkout', ['checkout_id'], unique=False)

    op.create_table(
        'checkout_item',
        sa.Column('checkout_item_id', sa.Integer(), nullable=False),
        sa.Column('checkout_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['checkout_id'], ['checkout.checkout_id']),
        sa.ForeignKeyConstraint(['item_id'], ['inventory.item_id']),
        sa.ForeignKeyConstraint(['location_id'], ['locations.location_id']),
        sa.PrimaryKeyConstraint('checkout_item_id')
    )
    op.create_index(op.f('ix_checkout_item_checkout_item_id'), 'checkout_item', ['checkout_item_id'], unique=False)
    op.create_index(op.f('ix_checkout_item_checkout_id'), 'checkout_item', ['checkout_id'], unique=False)
    op.create_index(op.f('ix_checkout_item_item_id'), 'checkout_item', ['item_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_checkout_item_item_id'), table_name='checkout_item')
    op.drop_index(op.f('ix_checkout_item_checkout_id'), table_name='checkout_item')
    op.drop_index(op.f('ix_checkout_item_checkout_item_id'), table_name='checkout_item')
    op.drop_table('checkout_item')

    op.drop_index(op.f('ix_checkout_checkout_id'), table_name='checkout')
    op.drop_table('checkout')
