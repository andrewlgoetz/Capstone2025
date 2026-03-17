"""fix location sequence and bank_id for existing rows

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2025-02-21

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f6g7h8i9j0k1'
down_revision: Union[str, Sequence[str], None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Reset the locations sequence to the current max location_id
    #    so new inserts get the next available ID instead of colliding.
    op.execute("""
        SELECT setval(
            pg_get_serial_sequence('locations', 'location_id'),
            COALESCE((SELECT MAX(location_id) FROM locations), 1)
        )
    """)

    # 2. Fix any locations that have a bank_id not matching any food_bank.
    #    Set them to bank_id=1 (the default bank) so they show up for admins.
    #    Adjust the value if your primary bank has a different ID.
    op.execute("""
        UPDATE locations
        SET bank_id = 1
        WHERE bank_id NOT IN (SELECT bank_id FROM food_banks)
           OR bank_id IS NULL
    """)


def downgrade() -> None:
    # Sequence and data fixes are not easily reversible; no-op
    pass
