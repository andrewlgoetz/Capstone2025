"""add checkin tables

Revision ID: be0149504147
Revises: 9132f445a044
Create Date: 2026-03-23 23:55:08.458983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'be0149504147'
down_revision: Union[str, Sequence[str], None] = '9132f445a044'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'checkin',
        sa.Column('checkin_id', sa.Integer(), nullable=False),
        sa.Column('received_by_user_id', sa.Integer(), nullable=False),
        sa.Column('donor_name', sa.String(), nullable=False),
        sa.Column('donor_type', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['received_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('checkin_id')
    )
    op.create_index(op.f('ix_checkin_checkin_id'), 'checkin', ['checkin_id'], unique=False)

    op.create_table(
        'checkin_item',
        sa.Column('checkin_item_id', sa.Integer(), nullable=False),
        sa.Column('checkin_id', sa.Integer(), nullable=False),
        sa.Column('item_id', sa.Integer(), nullable=False),
        sa.Column('location_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['checkin_id'], ['checkin.checkin_id']),
        sa.ForeignKeyConstraint(['item_id'], ['inventory.item_id']),
        sa.ForeignKeyConstraint(['location_id'], ['locations.location_id']),
        sa.PrimaryKeyConstraint('checkin_item_id')
    )
    op.create_index(op.f('ix_checkin_item_checkin_item_id'), 'checkin_item', ['checkin_item_id'], unique=False)
    op.create_index(op.f('ix_checkin_item_checkin_id'), 'checkin_item', ['checkin_id'], unique=False)
    op.create_index(op.f('ix_checkin_item_item_id'), 'checkin_item', ['item_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_checkin_item_item_id'), table_name='checkin_item')
    op.drop_index(op.f('ix_checkin_item_checkin_id'), table_name='checkin_item')
    op.drop_index(op.f('ix_checkin_item_checkin_item_id'), table_name='checkin_item')
    op.drop_table('checkin_item')

    op.drop_index(op.f('ix_checkin_checkin_id'), table_name='checkin')
    op.drop_table('checkin')