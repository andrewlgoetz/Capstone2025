"""Authentication and user management API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.schemas.auth_schema import (
    LoginRequest,
    TokenResponse,
    ChangePasswordRequest,
    UserCreate,
    UserRead,
    UserUpdate,
    TemporaryPasswordResponse,
    PermissionsListResponse,
    UserPermissionsUpdate,
    UserPermissionsResponse
)
from app.services import auth_service
from app.dependencies import get_db, get_current_user, get_current_active_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


# --------------- Public Endpoints (No Auth Required) ---------------

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint - accepts email (username) and password via OAuth2 form.
    Returns JWT access token and requires_password_change flag.

    The OAuth2PasswordRequestForm uses 'username' field for email.
    """
    user = auth_service.authenticate_user(form_data.username, form_data.password, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token with user_id as subject
    print(f"Login successful for user: {user.email}, user_id: {user.user_id}")
    access_token = auth_service.create_access_token(data={"sub": str(user.user_id)})

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        requires_password_change=user.requires_password_change
    )


# --------------- Protected Endpoints (Auth Required) ---------------

@router.get("/me", response_model=UserRead)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user's information.
    Works even if password change is required (for profile display).
    """
    role_name = auth_service.get_user_role(current_user, db)

    return UserRead(
        user_id=current_user.user_id,
        name=current_user.name,
        email=current_user.email,
        bank_id=current_user.bank_id,
        role_id=current_user.role_id,
        requires_password_change=current_user.requires_password_change,
        role_name=role_name
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Refresh access token for authenticated user.
    Issues a new token with fresh expiration.
    """
    access_token = auth_service.create_access_token(data={"sub": str(current_user.user_id)})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        requires_password_change=current_user.requires_password_change
    )


@router.get("/me/permissions", response_model=UserPermissionsResponse)
def get_my_permissions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's own permissions."""
    from app.services import permission_service
    permissions = permission_service.get_user_permissions(current_user.user_id, db)
    return UserPermissionsResponse(user_id=current_user.user_id, permissions=permissions)


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),  # Allow even if password change required
    db: Session = Depends(get_db)
):
    """
    Change password endpoint - accessible even when password change is required.
    Validates old password before allowing change.
    """
    auth_service.change_user_password(
        current_user.user_id,
        request.old_password,
        request.new_password,
        db
    )

    return {"message": "Password changed successfully"}


# --------------- Admin-Only Endpoints ---------------

@router.get("/users", response_model=List[UserRead])
def list_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: List all users in the system.
    """
    users_with_roles = auth_service.get_all_users(db)

    return [
        UserRead(
            user_id=user.user_id,
            name=user.name,
            email=user.email,
            bank_id=user.bank_id,
            role_id=user.role_id,
            requires_password_change=user.requires_password_change,
            role_name=role_name
        )
        for user, role_name in users_with_roles
    ]


@router.post("/users", response_model=TemporaryPasswordResponse, status_code=status.HTTP_201_CREATED)
def create_new_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Create a new user with a temporary password.
    Returns the user info and the temporary password (shown once).
    """
    new_user, temp_password = auth_service.create_user(
        name=user_data.name,
        email=user_data.email,
        bank_id=user_data.bank_id,
        role_id=user_data.role_id,
        db=db
    )

    role_name = auth_service.get_user_role(new_user, db)

    return TemporaryPasswordResponse(
        user=UserRead(
            user_id=new_user.user_id,
            name=new_user.name,
            email=new_user.email,
            bank_id=new_user.bank_id,
            role_id=new_user.role_id,
            requires_password_change=new_user.requires_password_change,
            role_name=role_name
        ),
        temporary_password=temp_password
    )


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user information (admin can update any user, users can update themselves).
    Password changes use the /change-password endpoint.
    """
    # Check permissions: admin can update anyone, users can only update themselves
    is_admin_user = auth_service.is_admin(current_user, db)
    if not is_admin_user and current_user.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own information"
        )

    user_to_update = auth_service.get_user_by_id(user_id, db)
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(user_to_update, field, value)

    db.commit()
    db.refresh(user_to_update)

    role_name = auth_service.get_user_role(user_to_update, db)

    return UserRead(
        user_id=user_to_update.user_id,
        name=user_to_update.name,
        email=user_to_update.email,
        bank_id=user_to_update.bank_id,
        role_id=user_to_update.role_id,
        requires_password_change=user_to_update.requires_password_change,
        role_name=role_name
    )


@router.post("/users/{user_id}/reset-password", response_model=TemporaryPasswordResponse)
def reset_user_password(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Reset a user's password and generate a new temporary password.
    The user will be required to change this password on next login.
    """
    user_to_reset = auth_service.get_user_by_id(user_id, db)
    if not user_to_reset:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate new temporary password
    temp_password = auth_service.generate_temporary_password()

    # Update user with new password hash and set requires_password_change flag
    user_to_reset.password_hash = auth_service.hash_password(temp_password)
    user_to_reset.requires_password_change = True

    db.commit()
    db.refresh(user_to_reset)

    role_name = auth_service.get_user_role(user_to_reset, db)

    return TemporaryPasswordResponse(
        user=UserRead(
            user_id=user_to_reset.user_id,
            name=user_to_reset.name,
            email=user_to_reset.email,
            bank_id=user_to_reset.bank_id,
            role_id=user_to_reset.role_id,
            requires_password_change=user_to_reset.requires_password_change,
            role_name=role_name
        ),
        temporary_password=temp_password
    )


@router.get("/users/{user_id}/activity")
def get_user_activity(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Get activity log for a specific user.
    Returns inventory actions (create, update, delete, scan in/out).
    """
    from app.models.activity_log import ActivityLog

    user = auth_service.get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.user_id == user_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(200)
        .all()
    )

    return [
        {
            "action": log.action.value,
            "item_id": log.entity_id,
            "item_name": log.item_name,
            "details": log.details,
            "timestamp": log.created_at.isoformat(),
        }
        for log in logs
    ]


# --------------- Permission Management Endpoints ---------------

@router.get("/permissions", response_model=PermissionsListResponse)
def get_all_permissions(current_user: User = Depends(require_admin)):
    """
    Admin-only: Get all available permissions with descriptions and groupings.
    Used by frontend to display permission options.
    """
    from app.services import permission_service
    return permission_service.get_all_permissions()


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
def get_user_permissions(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Get all permissions granted to a specific user.
    """
    from app.services import permission_service

    user = auth_service.get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    permissions = permission_service.get_user_permissions(user_id, db)
    return UserPermissionsResponse(user_id=user_id, permissions=permissions)


@router.put("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
def update_user_permissions(
    user_id: int,
    data: UserPermissionsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Admin-only: Update all permissions for a specific user.
    Replaces existing permissions with the provided list.
    """
    from app.services import permission_service

    user = auth_service.get_user_by_id(user_id, db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from removing their own permission management access
    if user_id == current_user.user_id:
        if permission_service.Permission.USERS_MANAGE_PERMISSIONS.value not in data.permissions:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove your own permission management access"
            )

    # Inventory create/edit/delete require inventory:view
    inventory_view = permission_service.Permission.INVENTORY_VIEW.value
    inventory_dependents = [
        permission_service.Permission.INVENTORY_CREATE.value,
        permission_service.Permission.INVENTORY_EDIT.value,
        permission_service.Permission.INVENTORY_DELETE.value,
    ]
    if any(p in data.permissions for p in inventory_dependents) and inventory_view not in data.permissions:
        raise HTTPException(
            status_code=400,
            detail="Inventory create/edit/delete permissions require inventory:view"
        )

    permission_service.set_user_permissions(user_id, data.permissions, db)
    permissions = permission_service.get_user_permissions(user_id, db)
    return UserPermissionsResponse(user_id=user_id, permissions=permissions)
