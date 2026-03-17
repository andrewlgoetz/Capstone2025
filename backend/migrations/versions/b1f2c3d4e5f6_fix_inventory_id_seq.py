"""fix inventory id sequence

Revision ID: b1f2c3d4e5f6
Revises: 610418b9171c
Create Date: 2025-11-11 21:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1f2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '610418b9171c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sequence if missing
    op.execute("CREATE SEQUENCE IF NOT EXISTS inventory_item_id_seq;")

    # Set sequence value to current max(item_id) so nextval yields max+1
    op.execute(
        "SELECT setval('inventory_item_id_seq', COALESCE((SELECT MAX(item_id) FROM inventory), 1));"
    )

    # Attach sequence as default for the column
    op.execute(
        "ALTER TABLE inventory ALTER COLUMN item_id SET DEFAULT nextval('inventory_item_id_seq');"
    )

    # Make sequence owned by the column (tidy)
    op.execute("ALTER SEQUENCE inventory_item_id_seq OWNED BY inventory.item_id;")


def downgrade() -> None:
    # Remove default and drop sequence
    op.execute("ALTER TABLE inventory ALTER COLUMN item_id DROP DEFAULT;")
    op.execute("DROP SEQUENCE IF EXISTS inventory_item_id_seq;")
