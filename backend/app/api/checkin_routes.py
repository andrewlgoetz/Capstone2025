from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.user import User
from app.models.inventory import InventoryItem
from app.models.checkin import Checkin, CheckinItem
from app.models.inventory_movement import MovementType
from app.schemas.checkin_schema import CheckinCompleteRequest, CheckinCompleteResponse
from app.services.permission_service import require_any_permission, Permission
from app.services import inventory_service

router = APIRouter(prefix="/checkin", tags=["Checkin"])


@router.post("/complete", response_model=CheckinCompleteResponse)
def complete_checkin(
    payload: CheckinCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(Permission.INVENTORY_VIEW, Permission.SCAN_IN)
    ),
):
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in must include at least one item.",
        )

    if not payload.donor_name or not payload.donor_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Donor name is required.",
        )

    total_quantity = 0

    try:
        checkin = Checkin(
            received_by_user_id=current_user.user_id,
            donor_name=payload.donor_name.strip(),
            donor_type=payload.donor_type.strip() if payload.donor_type else None,
        )
        db.add(checkin)
        db.flush()

        for line in payload.items:
            item = (
                db.query(InventoryItem)
                .filter(InventoryItem.item_id == line.item_id)
                .first()
            )

            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Item {line.item_id} not found.",
                )

            if line.location_id is not None and item.location_id != line.location_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Item {line.item_id} is not in location {line.location_id}.",
                )

            # Reuse existing inventory logic so quantity increases
            # and an INBOUND movement gets recorded
            inventory_service.adjust_item_quantity(
                item_id=item.item_id,
                delta=line.quantity,
                db=db,
                movement_type=MovementType.INBOUND,
                user_id=current_user.user_id,
            )

            checkin_item = CheckinItem(
                checkin_id=checkin.checkin_id,
                item_id=item.item_id,
                location_id=item.location_id,
                quantity=line.quantity,
            )
            db.add(checkin_item)

            total_quantity += line.quantity

        db.commit()
        db.refresh(checkin)

        return CheckinCompleteResponse(
            checkin_id=checkin.checkin_id,
            item_count=len(payload.items),
            total_quantity=total_quantity,
            message="Check-in completed successfully.",
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Check-in failed: {str(e)}",
        )