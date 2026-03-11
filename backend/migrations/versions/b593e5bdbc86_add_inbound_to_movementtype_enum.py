"""add_inbound_to_movementtype_enum

Revision ID: b593e5bdbc86
Revises: e9c03bb0a9e9
Create Date: 2026-03-11 15:16:44.195906

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b593e5bdbc86'
down_revision: Union[str, Sequence[str], None] = 'e9c03bb0a9e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add INBOUND value to movementtype enum
    op.execute("ALTER TYPE movementtype ADD VALUE IF NOT EXISTS 'INBOUND'")


def downgrade() -> None:
    """Downgrade schema."""
    # Note: PostgreSQL doesn't support removing enum values directly
    # You would need to recreate the enum type to remove a value
    pass
