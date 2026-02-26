"""merge_category_and_auth_branches

Revision ID: 5161b5da5071
Revises: 9178422f9ce0, d4e5f6g7h8i9
Create Date: 2026-02-25 19:46:15.433554

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5161b5da5071'
down_revision: Union[str, Sequence[str], None] = ('9178422f9ce0', 'd4e5f6g7h8i9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
