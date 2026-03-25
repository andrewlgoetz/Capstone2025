"""add_inventory_movement_created_at_index

Adds a composite index on (created_at, item_id) on the inventory_movement
table.  All forecasting extraction queries filter by movement type, bank_id
(via a join to inventory), and a created_at date range, so this index is
critical for query performance as movement history grows.

Revision ID: fc3a8d912b47
Revises: b593e5bdbc86
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc3a8d912b47'
down_revision: Union[str, Sequence[str], None] = 'b593e5bdbc86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite index on inventory_movement (created_at, item_id)."""
    op.create_index(
        'ix_inventory_movement_created_at_item_id',
        'inventory_movement',
        ['created_at', 'item_id'],
        unique=False,
    )


def downgrade() -> None:
    """Drop the composite index."""
    op.drop_index(
        'ix_inventory_movement_created_at_item_id',
        table_name='inventory_movement',
    )
