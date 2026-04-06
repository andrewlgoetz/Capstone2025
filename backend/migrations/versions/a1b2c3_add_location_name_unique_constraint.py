"""add_location_name_unique_constraint

Adds a unique constraint on (bank_id, name) in the locations table so that
a food bank cannot have two locations with the same name.

Revision ID: a1b2c3loc001
Revises: 0ef06006e1be
Create Date: 2026-04-05

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'a1b2c3loc001'
down_revision: Union[str, Sequence[str], None] = '0ef06006e1be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_locations_bank_id_name',
        'locations',
        ['bank_id', 'name'],
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_locations_bank_id_name',
        'locations',
        type_='unique',
    )
