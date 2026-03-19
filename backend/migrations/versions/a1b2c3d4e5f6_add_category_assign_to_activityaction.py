"""add_category_assign_to_activityaction_enum

Revision ID: a1b2c3d4e5f6
Revises: b593e5bdbc86
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add CATEGORY_ASSIGN value to activityaction enum."""
    op.execute("ALTER TYPE activityaction ADD VALUE IF NOT EXISTS 'CATEGORY_ASSIGN'")


def downgrade() -> None:
    """PostgreSQL does not support removing enum values directly."""
    pass
