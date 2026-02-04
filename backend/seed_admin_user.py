"""Seed script to create an admin user for testing the authentication system."""

import bcrypt
from app.db.session import SessionLocal
from app.models.user import User
from app.models.role import Role

def seed_admin_user():
    """Create or update an admin user with known credentials for testing."""
    db = SessionLocal()

    try:
        # Get admin role (should already exist)
        admin_role = db.query(Role).filter(Role.name.ilike("admin")).first()
        if not admin_role:
            print("Error: Admin role not found in database!")
            return

        print(f"Found admin role with ID: {admin_role.role_id}")

        # Check if admin@hamfoodbank.ca exists
        existing_admin = db.query(User).filter(User.email == "admin@hamfoodbank.ca").first()

        if existing_admin:
            # Update existing user's password and ensure they have admin role
            password = "admin123"
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
            existing_admin.password_hash = hashed.decode('utf-8')
            existing_admin.role_id = admin_role.role_id
            existing_admin.requires_password_change = False
            db.commit()

            print("\nUpdated existing admin user:")
            print(f"  Email: {existing_admin.email}")
            print(f"  Name: {existing_admin.name}")
            print("  Password: admin123")
            print("\nYou can now log in with these credentials.")
        else:
            # Create new admin user
            password = "admin123"
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
            admin_user = User(
                name="Admin User",
                email="admin@foodbank.com",
                password_hash=hashed.decode('utf-8'),
                bank_id=1,
                role_id=admin_role.role_id,
                requires_password_change=False
            )

            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

            print("\nAdmin user created successfully!")
            print("\nLogin credentials:")
            print("  Email: admin@foodbank.com")
            print("  Password: admin123")
            print("\nYou can now log in to the application with these credentials.")

    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Setting up admin user...")
    seed_admin_user()
