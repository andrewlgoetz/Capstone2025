from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import Optional

from app.models.activity_log import ActivityLog, ActivityAction
from app.models.user import User
from app.models.role import Role
from app.dependencies import get_db, get_current_active_user
from app.services.permission_service import Permission, require_any_permission

router = APIRouter(prefix="/activity-log", tags=["Activity Log"])


@router.get("/item-changes")
def get_item_changes(
    limit: int = Query(100, description="Max entries to return"),
    entity_type: Optional[str] = Query(None, description="Filter by entity_type: 'inventory' or 'category'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(
        Permission.CATEGORY_EDIT, Permission.INVENTORY_VIEW
    )),
):
    """
    Return recent item field changes and category events for the Item Manager.
    Excludes pure quantity movements (SCAN_IN, SCAN_OUT).
    Includes: CREATE, UPDATE (item fields), CATEGORY_ASSIGN, and all category entity actions.
    """
    excluded_actions = [ActivityAction.SCAN_IN, ActivityAction.SCAN_OUT]

    query = (
        db.query(
            ActivityLog.id,
            ActivityLog.action,
            ActivityLog.entity_type,
            ActivityLog.entity_id,
            ActivityLog.item_name,
            ActivityLog.details,
            ActivityLog.created_at,
            User.user_id.label("user_id"),
            User.name.label("user_name"),
            Role.name.label("role_name"),
        )
        .join(User, ActivityLog.user_id == User.user_id)
        .outerjoin(Role, User.role_id == Role.role_id)
        .filter(
            User.bank_id == current_user.bank_id,
            ~ActivityLog.action.in_(excluded_actions),
        )
    )

    if entity_type == "category":
        # Include category admin actions AND category assignments on inventory items
        query = query.filter(
            or_(
                ActivityLog.entity_type == "category",
                ActivityLog.action == ActivityAction.CATEGORY_ASSIGN,
            )
        )
    elif entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)

    rows = query.order_by(desc(ActivityLog.created_at)).limit(limit).all()

    return [
        {
            "id": r.id,
            "action": r.action.value if hasattr(r.action, "value") else str(r.action),
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "item_name": r.item_name,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "user_id": r.user_id,
            "user_name": r.user_name or "Unknown",
            "role_name": r.role_name or "—",
        }
        for r in rows
    ]
