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
    """Seed roles, food banks, and users from the live database snapshot."""
    conn = op.get_bind()

    # --- Roles (no FK dependencies) ---
    conn.execute(sa.text("""
        INSERT INTO roles (role_id, name) VALUES
        (1, 'Admin'),
        (2, 'Manager'),
        (3, 'Volunteer'),
        (4, 'Driver')
        ON CONFLICT DO NOTHING
    """))

    # --- Food Banks (no FK dependencies) ---
    conn.execute(sa.text("""
        INSERT INTO food_banks (bank_id, name, address) VALUES
        (1, 'Hamilton Community Food Bank', '500 King St E, Hamilton, ON'),
        (2, 'Niagara Harvest Center', '220 Welland Ave, St. Catharines, ON'),
        (3, 'Peel Family Food Assistance', '102 Main St, Mississauga, ON')
        ON CONFLICT DO NOTHING
    """))

    # --- Users (FK to roles + food_banks) ---
    # Named params used for password_hash to safely handle bcrypt $ characters.
    users = [
        {"uid": 1,  "name": "Haley Johnson",  "email": "haley@hamfoodbank.ca",     "pw": "hashed_pw_1",                                                                          "rid": 1, "bid": 1, "rpc": False},
        {"uid": 2,  "name": "Tony Singh",      "email": "tony@hamfoodbank.ca",      "pw": "hashed_pw_2",                                                                          "rid": 2, "bid": 1, "rpc": False},
        {"uid": 3,  "name": "Marina Patel",    "email": "marina@niagaraharvest.ca", "pw": "hashed_pw_3",                                                                          "rid": 1, "bid": 2, "rpc": False},
        {"uid": 4,  "name": "Liam Chen",       "email": "liam@niagaraharvest.ca",   "pw": "hashed_pw_4",                                                                          "rid": 3, "bid": 2, "rpc": False},
        {"uid": 5,  "name": "Isabella Brown",  "email": "isabella@peelfamily.org",  "pw": "hashed_pw_5",                                                                          "rid": 1, "bid": 3, "rpc": False},
        {"uid": 6,  "name": "David Moore",     "email": "david@peelfamily.org",     "pw": "hashed_pw_6",                                                                          "rid": 3, "bid": 3, "rpc": False},
        {"uid": 7,  "name": "Alex Rider",      "email": "alexr@hamfoodbank.ca",     "pw": "hashed_pw_7",                                                                          "rid": 4, "bid": 1, "rpc": False},
        {"uid": 8,  "name": "Admin",           "email": "admin@hamfoodbank.ca",     "pw": "$2b$12$SfvJKfCzoMoovcvDZPva2eoOzBqtvh0Taxh5ng4zxhK5cuEXrTGWO",                      "rid": 1, "bid": 1, "rpc": False},
        {"uid": 9,  "name": "Andy",            "email": "Andy@hamfoodbank.ca",      "pw": "$2b$12$dFsaD1wHvPdfmMwfv9/2p.rNRlzSK.V8/Na1akEao8jVvlwf3UFGC",                      "rid": 1, "bid": 1, "rpc": False},
        {"uid": 10, "name": "Joe",             "email": "Joe@hamfoodbank.ca",       "pw": "$2b$12$oZBbOd7.sCN8rjEN57duUugJKIZeGCnvpsHPOvus75wFGI7jOGRCe",                      "rid": 2, "bid": 1, "rpc": False},
        {"uid": 11, "name": "Test Perms",      "email": "test@ham.ca",              "pw": "$2b$12$WjZxFCL4iHpJkB3lBbYGHOCuH7Z0i.ikMMVodnMrUBS40uZ09QCeu",                      "rid": 3, "bid": 1, "rpc": False},
        {"uid": 12, "name": "TestPerms2",      "email": "test@hamfoodbank.ca",      "pw": "$2b$12$oO5VJ8FG624Z2/V.rwrjbOoBVPGvI0SZPWyINGCxIZD5yRnEwyViK",                      "rid": 3, "bid": 1, "rpc": False},
    ]

    for u in users:
        conn.execute(sa.text("""
            INSERT INTO users (user_id, name, email, password_hash, role_id, bank_id, requires_password_change)
            VALUES (:uid, :name, :email, :pw, :rid, :bid, :rpc)
            ON CONFLICT (email) DO NOTHING
        """), u)


def downgrade() -> None:
    pass
