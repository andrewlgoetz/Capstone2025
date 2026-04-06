"""seed auth data - roles, food banks, and users

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-02-25 00:00:00.000000

Seeds a copy of the current roles, food_banks, and users tables so that
`alembic upgrade head` produces a working auth state.

Users 1-7 have placeholder password hashes (from initial CSV seed).
Users 8-12 have real bcrypt hashes and are the active accounts.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6g7h8i9j0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6g7h8i9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Preserve schema-only migration history without seeding auth data."""
    pass


def downgrade() -> None:
    pass
