"""Authentication service for user management and JWT token handling."""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import secrets
import string
import os

from app.models.user import User
from app.models.role import Role

# Configuration - load from environment variables
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


# --------------- Password Utilities ---------------

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a hashed password."""
    # return True
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def generate_temporary_password(length: int = 12) -> str:
    """
    Generate a cryptographically secure random temporary password.

    Args:
        length: Length of the password (default: 12)

    Returns:
        Random password containing letters, digits, and special characters
    """
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# --------------- JWT Token Utilities ---------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token with optional expiration.

    Args:
        data: Dictionary containing token payload (typically {'sub': user_id})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        Dictionary containing token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# --------------- Authentication Logic ---------------

def authenticate_user(email: str, password: str, db: Session) -> Optional[User]:
    """
    Authenticate a user by email and password.

    Args:
        email: User email address
        password: Plaintext password
        db: Database session

    Returns:
        User object if credentials are valid, None otherwise
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_user_by_id(user_id: int, db: Session) -> Optional[User]:
    """
    Retrieve a user by their user_id.

    Args:
        user_id: User ID
        db: Database session

    Returns:
        User object if found, None otherwise
    """
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_role(user: User, db: Session) -> Optional[str]:
    """
    Get the role name for a user.

    Args:
        user: User object
        db: Database session

    Returns:
        Role name string if user has a role, None otherwise
    """
    if user.role_id is None:
        return None
    role = db.query(Role).filter(Role.role_id == user.role_id).first()
    return role.name if role else None


def is_admin(user: User, db: Session) -> bool:
    """
    Check if a user has admin role.

    Args:
        user: User object
        db: Database session

    Returns:
        True if user is admin, False otherwise
    """
    role_name = get_user_role(user, db)
    return role_name and role_name.lower() == "admin"


# --------------- User Management ---------------

def create_user(name: str, email: str, bank_id: int, role_id: Optional[int], db: Session) -> tuple[User, str]:
    """
    Create a new user with a temporary password.

    Args:
        name: User's full name
        email: User's email address
        bank_id: Food bank ID
        role_id: Role ID (optional)
        db: Database session

    Returns:
        Tuple of (User object, temporary password string)

    Raises:
        HTTPException: If email already exists
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Generate temporary password
    temp_password = generate_temporary_password()

    # Create user
    new_user = User(
        name=name,
        email=email,
        password_hash=hash_password(temp_password),
        bank_id=bank_id,
        role_id=role_id,
        requires_password_change=True  # Force password change on first login
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Grant default or admin permissions based on role
    from app.services.permission_service import grant_default_permissions, grant_admin_permissions
    ADMIN_ROLE_ID = 1
    if role_id == ADMIN_ROLE_ID:
        grant_admin_permissions(new_user.user_id, db)
    else:
        grant_default_permissions(new_user.user_id, db)

    return new_user, temp_password


def change_user_password(user_id: int, old_password: str, new_password: str, db: Session) -> User:
    """
    Change a user's password after verifying the old password.
    Clears the requires_password_change flag.

    Args:
        user_id: User ID
        old_password: Current password (for verification)
        new_password: New password to set
        db: Database session

    Returns:
        Updated User object

    Raises:
        HTTPException: If user not found, old password incorrect, or new password invalid
    """
    user = get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify old password
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    # Validate new password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long"
        )

    # Update password
    user.password_hash = hash_password(new_password)
    user.requires_password_change = False

    db.commit()
    db.refresh(user)

    return user


def get_all_users(db: Session) -> list[tuple[User, Optional[str]]]:
    """
    Get all users with their role names.

    Args:
        db: Database session

    Returns:
        List of tuples containing (User object, role name string)
    """
    users = db.query(User).all()
    result = []
    for user in users:
        role_name = get_user_role(user, db)
        result.append((user, role_name))
    return result
