"""add activity_log table for user action tracking

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create activity_log table."""
    op.create_table(
        'activity_log',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=False, index=True),
        sa.Column('action', sa.Enum('CREATE', 'UPDATE', 'DELETE', 'SCAN_IN', 'SCAN_OUT', name='activityaction'), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False, server_default='inventory'),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('item_name', sa.String(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
    )


def downgrade() -> None:
    """Drop activity_log table."""
    op.drop_table('activity_log')
    op.execute("DROP TYPE IF EXISTS activityaction")
