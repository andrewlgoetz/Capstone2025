"""
Permission service module - defines and manages granular user permissions.

This module provides:
- Permission definitions
- Permission checking functions
- FastAPI dependencies for permission-based access control
"""

from enum import Enum
from typing import List, Callable
from functools import wraps
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_permission import UserPermission
from app.dependencies import get_db, get_current_active_user


class Permission(str, Enum):
    """
    All available permissions in the system.
    Add new permissions here as needed - the system is designed to be extendable.
    """
    # Inventory permissions
    INVENTORY_VIEW = "inventory:view"
    INVENTORY_CREATE = "inventory:create"
    INVENTORY_EDIT = "inventory:edit"
    INVENTORY_DELETE = "inventory:delete"

    # Barcode/scanning permissions
    SCAN_IN = "barcode:scan_in"
    SCAN_OUT = "barcode:scan_out"

    # Reports permissions
    REPORTS_VIEW = "reports:view"
    REPORTS_DOWNLOAD = "reports:download"

    # Dashboard permissions
    DASHBOARD_VIEW = "dashboard:view"

    # User management permissions (admin-level)
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_EDIT = "users:edit"
    USERS_DELETE = "users:delete"
    USERS_MANAGE_PERMISSIONS = "users:manage_permissions"

    # Category management permissions
    CATEGORY_CREATE = "category:create"
    CATEGORY_EDIT = "category:edit"

    # Dietary restriction management permissions
    DIETARY_CREATE = "dietary:create"
    DIETARY_EDIT = "dietary:edit"


# Human-readable descriptions for each permission
PERMISSION_DESCRIPTIONS = {
    Permission.INVENTORY_VIEW: "View inventory items",
    Permission.INVENTORY_CREATE: "Create new inventory items",
    Permission.INVENTORY_EDIT: "Edit existing inventory items",
    Permission.INVENTORY_DELETE: "Delete inventory items",
    Permission.SCAN_IN: "Scan items into inventory",
    Permission.SCAN_OUT: "Scan items out of inventory",
    Permission.REPORTS_VIEW: "View reports and analytics",
    Permission.REPORTS_DOWNLOAD: "Download reports as files",
    Permission.DASHBOARD_VIEW: "View the dashboard",
    Permission.USERS_VIEW: "View list of users",
    Permission.USERS_CREATE: "Create new users",
    Permission.USERS_EDIT: "Edit user information",
    Permission.USERS_DELETE: "Delete users",
    Permission.USERS_MANAGE_PERMISSIONS: "Manage user permissions",
    Permission.CATEGORY_CREATE: "Create new categories when entering items",
    Permission.CATEGORY_EDIT: "Edit item categories and manage the category list",
    Permission.DIETARY_CREATE: "Create new dietary restriction tags",
    Permission.DIETARY_EDIT: "Edit and manage dietary restriction tags",
}

# Group permissions by category for UI display
PERMISSION_GROUPS = {
    "Inventory Management": [
        Permission.INVENTORY_VIEW,
        Permission.INVENTORY_CREATE,
        Permission.INVENTORY_EDIT,
        Permission.INVENTORY_DELETE,
    ],
    "Barcode Scanning": [
        Permission.SCAN_IN,
        Permission.SCAN_OUT,
    ],
    "Reports & Analytics": [
        Permission.REPORTS_VIEW,
        Permission.REPORTS_DOWNLOAD,
    ],
    "Dashboard": [
        Permission.DASHBOARD_VIEW,
    ],
    "User Administration": [
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_EDIT,
        Permission.USERS_DELETE,
        Permission.USERS_MANAGE_PERMISSIONS,
    ],
    "Category Management": [
        Permission.CATEGORY_CREATE,
        Permission.CATEGORY_EDIT,
    ],
    "Dietary Restrictions": [
        Permission.DIETARY_CREATE,
        Permission.DIETARY_EDIT,
    ],
}


def get_user_permissions(user_id: int, db: Session) -> List[str]:
    """Get all permissions for a user."""
    permissions = db.query(UserPermission).filter(
        UserPermission.user_id == user_id
    ).all()
    return [p.permission for p in permissions]


def user_has_permission(user_id: int, permission: Permission, db: Session) -> bool:
    """Check if a user has a specific permission."""
    exists = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission == permission.value
    ).first()
    return exists is not None


def grant_permission(user_id: int, permission: Permission, db: Session) -> bool:
    """Grant a permission to a user. Returns True if granted, False if already exists."""
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission == permission.value
    ).first()

    if existing:
        return False

    new_permission = UserPermission(
        user_id=user_id,
        permission=permission.value
    )
    db.add(new_permission)
    db.commit()
    return True


def revoke_permission(user_id: int, permission: Permission, db: Session) -> bool:
    """Revoke a permission from a user. Returns True if revoked, False if didn't exist."""
    existing = db.query(UserPermission).filter(
        UserPermission.user_id == user_id,
        UserPermission.permission == permission.value
    ).first()

    if not existing:
        return False

    db.delete(existing)
    db.commit()
    return True


def set_user_permissions(user_id: int, permissions: List[str], db: Session) -> None:
    """Set all permissions for a user (replaces existing permissions)."""
    # Delete all existing permissions
    db.query(UserPermission).filter(UserPermission.user_id == user_id).delete()

    # Add new permissions
    for perm in permissions:
        # Validate permission exists in enum
        if perm in [p.value for p in Permission]:
            new_permission = UserPermission(
                user_id=user_id,
                permission=perm
            )
            db.add(new_permission)

    db.commit()


def grant_default_permissions(user_id: int, db: Session) -> None:
    """Grant default permissions to a new user."""
    default_permissions = [
        Permission.INVENTORY_VIEW,
        Permission.SCAN_IN,
        Permission.SCAN_OUT,
        Permission.DASHBOARD_VIEW,
    ]
    for perm in default_permissions:
        grant_permission(user_id, perm, db)


def grant_admin_permissions(user_id: int, db: Session) -> None:
    """Grant all permissions to an admin user."""
    for perm in Permission:
        grant_permission(user_id, perm, db)


def get_all_permissions() -> dict:
    """
    Get all available permissions with descriptions and groupings.
    Used by frontend to display permission options.
    """
    return {
        "permissions": [
            {
                "key": perm.value,
                "name": perm.name.replace("_", " ").title(),
                "description": PERMISSION_DESCRIPTIONS.get(perm, "")
            }
            for perm in Permission
        ],
        "groups": {
            group: [p.value for p in perms]
            for group, perms in PERMISSION_GROUPS.items()
        }
    }


# -------------------- FastAPI Dependencies --------------------

def require_permission(permission: Permission):
    """
    FastAPI dependency factory that checks if the current user has a specific permission.
    Admins (role_id == 1) automatically have all permissions.

    Usage:
        @router.get("/items")
        def get_items(user: User = Depends(require_permission(Permission.INVENTORY_VIEW))):
            ...
    """
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        # Import here to avoid circular imports
        from app.services import auth_service

        # Admins have all permissions
        if auth_service.is_admin(current_user, db):
            return current_user

        # Check specific permission
        if not user_has_permission(current_user.user_id, permission, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: {permission.value}"
            )

        return current_user

    return permission_checker


def require_any_permission(*permissions: Permission):
    """
    FastAPI dependency factory that checks if the user has ANY of the specified permissions.
    Admins automatically pass.

    Usage:
        @router.get("/items")
        def get_items(user: User = Depends(require_any_permission(Permission.INVENTORY_VIEW, Permission.REPORTS_VIEW))):
            ...
    """
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        from app.services import auth_service

        # Admins have all permissions
        if auth_service.is_admin(current_user, db):
            return current_user

        # Check if user has any of the required permissions
        for perm in permissions:
            if user_has_permission(current_user.user_id, perm, db):
                return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required one of: {[p.value for p in permissions]}"
        )

    return permission_checker


def require_all_permissions(*permissions: Permission):
    """
    FastAPI dependency factory that checks if the user has ALL specified permissions.
    Admins automatically pass.

    Usage:
        @router.get("/sensitive")
        def sensitive(user: User = Depends(require_all_permissions(Permission.INVENTORY_VIEW, Permission.REPORTS_VIEW))):
            ...
    """
    def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db)
    ) -> User:
        from app.services import auth_service

        # Admins have all permissions
        if auth_service.is_admin(current_user, db):
            return current_user

        # Check if user has all required permissions
        missing = []
        for perm in permissions:
            if not user_has_permission(current_user.user_id, perm, db):
                missing.append(perm.value)

        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Missing: {missing}"
            )

        return current_user

    return permission_checker
