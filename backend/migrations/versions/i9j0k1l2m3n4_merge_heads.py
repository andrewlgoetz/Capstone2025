"""merge heads for dietary restrictions

Revision ID: i9j0k1l2m3n4
Revises: 5d2e256be95b, h8i9j0k1l2m3
Create Date: 2026-03-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, Sequence[str], None] = ('5d2e256be95b', 'h8i9j0k1l2m3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
