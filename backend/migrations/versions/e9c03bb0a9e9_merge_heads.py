"""merge_heads

Revision ID: e9c03bb0a9e9
Revises: 5161b5da5071, 6c9d607ea0fc
Create Date: 2026-03-11 15:16:39.224242

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9c03bb0a9e9'
down_revision: Union[str, Sequence[str], None] = ('5161b5da5071', '6c9d607ea0fc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
