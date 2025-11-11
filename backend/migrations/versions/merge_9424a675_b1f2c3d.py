"""merge heads 9424a6750407 and b1f2c3d4e5f6

Revision ID: merge_9424a675_b1f2c3d
Revises: 9424a6750407, b1f2c3d4e5f6
Create Date: 2025-11-11 21:50:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'merge_9424a675_b1f2c3d'
down_revision: Union[str, Sequence[str], None] = ('9424a6750407', 'b1f2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # This is a merge migration to join multiple heads.
    # No DB operations required here; the revision exists to unify the history.
    pass


def downgrade() -> None:
    # Downgrade of a merge revision is context specific; do nothing.
    pass
