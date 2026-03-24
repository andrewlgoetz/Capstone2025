"""merge_checkin_and_categories_branches

Revision ID: 5d2e256be95b
Revises: add_qty_after, be0149504147
Create Date: 2026-03-24 09:44:32.165318

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d2e256be95b'
down_revision: Union[str, Sequence[str], None] = ('add_qty_after', 'be0149504147')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
