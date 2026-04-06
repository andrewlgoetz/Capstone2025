"""Drop and recreate the public schema — wipes everything including alembic_version.

Run from backend/:
    python reset_db.py

Then:
    alembic upgrade head
    python seed_db.py
    python seed_admin_user.py
"""

from dotenv import load_dotenv
load_dotenv()

from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DROP SCHEMA public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))
    conn.commit()

print("Database wiped. Now run:")
print("  alembic upgrade head")
print("  python seed_db.py")
print("  python seed_admin_user.py")
