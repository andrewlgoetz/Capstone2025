"""add_quantity_after_to_inventory_movement

Revision ID: add_qty_after
Revises: 092efd869d7d
Create Date: 2026-03-23 22:57:22.999331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_qty_after'
down_revision: Union[str, Sequence[str], None] = '092efd869d7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inventory_movement', sa.Column('quantity_after', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('inventory_movement', 'quantity_after')
