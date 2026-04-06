"""Reset the database schema and optionally rerun migrations."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from sqlalchemy import text

from app.db.session import engine

load_dotenv()

BACKEND_ROOT = Path(__file__).resolve().parent
ALEMBIC_INI_PATH = BACKEND_ROOT / "alembic.ini"


def reset_database() -> None:
    """Drop and recreate the public schema."""
    engine.dispose()
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.commit()
    engine.dispose()


def run_migrations() -> None:
    """Recreate the schema from Alembic migrations."""
    alembic_cfg = Config(str(ALEMBIC_INI_PATH))
    command.upgrade(alembic_cfg, "head")
    engine.dispose()


def reset_and_migrate_database() -> None:
    """Reset the database, then recreate the schema from migrations."""
    reset_database()
    run_migrations()


def main() -> None:
    reset_database()
    print("Database wiped. Now run:")
    print("  alembic upgrade head")
    print("  python seed_db.py")
    print("  python seed_admin_user.py")


if __name__ == "__main__":
    main()
