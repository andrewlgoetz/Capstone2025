"""add requires_password_change to users

Revision ID: b2c3d4e5f6g7
Revises: 5a4ea0d991d5
Create Date: 2026-01-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = '5a4ea0d991d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add requires_password_change column to users table
    op.add_column('users', sa.Column('requires_password_change', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove requires_password_change column from users table
    op.drop_column('users', 'requires_password_change')
