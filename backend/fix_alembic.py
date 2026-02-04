"""Manually fix the alembic_version table to match the current migration files."""

import psycopg2

# Database connection parameters
DB_PARAMS = {
    'dbname': 'inventory_db',
    'user': 'myuser',
    'password': 'mypassword',
    'host': 'localhost',
    'port': '5432'
}

# The current head revision (from the migration files)
CURRENT_HEAD = "5a4ea0d991d5"

# Connect to the database
conn = psycopg2.connect(**DB_PARAMS)
conn.autocommit = True
cursor = conn.cursor()

# Check current version
cursor.execute("SELECT version_num FROM alembic_version;")
rows = cursor.fetchall()

if rows:
    current_version = rows[0][0]
    print(f"Current version in database: {current_version}")

    # Update to the correct head
    cursor.execute("UPDATE alembic_version SET version_num = %s", (CURRENT_HEAD,))
    print(f"Updated alembic_version to: {CURRENT_HEAD}")
else:
    # No version exists, insert one
    cursor.execute("INSERT INTO alembic_version (version_num) VALUES (%s)", (CURRENT_HEAD,))
    print(f"Inserted alembic_version: {CURRENT_HEAD}")

cursor.close()
conn.close()

print("Alembic version fixed!")
