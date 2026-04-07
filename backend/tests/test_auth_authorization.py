"""
These tests verify the security boundary of the FastAPI backend:
1. Access Control: Unauthorized users are completely blocked from viewing data.
2. Login Security: The system correctly rejects invalid passwords.
3. Session Management: Valid logins securely generate JWT Bearer tokens.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# --- SQLite JSONB Override ---
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
# -----------------------------

from app.main import app
from app.dependencies import get_db
from app.db.session import Base
from app.models.user import User
from app.services.auth_service import hash_password

# --- Test Database & Client Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool # Keeps the in-memory database alive for the TestClient
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Seeds the in-memory database with a mock user for auth testing."""
    # Create all tables (Because app.main is imported, all models are registered to Base)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed a test user with a known password
    test_user = User(
        name="Test Admin",
        email="testadmin@hamfoodbank.ca",
        password_hash=hash_password("SecurePassword123"),
        bank_id=1,
        role_id=1, # 1 = Admin
    )
    db.add(test_user)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)


# --- Access Control (Unauthorized Blocked) ---

def test_unauthorized_user_blocked_from_inventory():
    """Verifies that requests without a valid JWT token are completely blocked (401)."""
    response = client.post("/barcode/scan-out", json={"barcode": "12345"})
    
    assert response.status_code == 401
    assert "Not authenticated" in response.text or "Unauthorized" in response.text


# --- Login Security (Reject Invalid Passwords) ---

def test_login_rejects_invalid_password():
    """Verifies the system securely rejects incorrect passwords and prevents access."""
    response = client.post(
        "/auth/login", 
        data={"username": "testadmin@hamfoodbank.ca", "password": "WrongPassword!"}
    )
    
    assert response.status_code in [400, 401]
    assert "Incorrect email or password" in response.text or "Unauthorized" in response.text


# --- Login Security (Manage User Sessions with Tokens) ---

def test_login_accepts_valid_credentials_and_generates_token():
    """Verifies valid credentials succeed and securely generate a JWT token."""
    response = client.post(
        "/auth/login", 
        data={"username": "testadmin@hamfoodbank.ca", "password": "SecurePassword123"}
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify token payload shape conforms to OAuth2 standards
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    
    # Verify the generated token actually grants access to protected routes
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    
    secure_response = client.get("/barcode/12345", headers=headers)
    
    # Even if barcode isn't found (404), the auth middleware passed (Not 401)
    assert secure_response.status_code != 401