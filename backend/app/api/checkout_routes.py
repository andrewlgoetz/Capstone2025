from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.dependencies import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.inventory import InventoryItem
from app.models.inventory_movement import InventoryMovement, MovementType
from app.models.checkout import Checkout, CheckoutItem
from app.schemas.checkout_schema import CheckoutCompleteRequest, CheckoutCompleteResponse
from app.services.permission_service import require_any_permission, Permission

router = APIRouter(prefix="/checkout", tags=["Checkout"])


@router.post("/complete", response_model=CheckoutCompleteResponse)
def complete_checkout(
    payload: CheckoutCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(Permission.INVENTORY_VIEW, Permission.SCAN_OUT)
    ),
):
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout must include at least one item.",
        )

    total_quantity = 0

    try:
        # Create checkout session row
        checkout = Checkout(
            served_by_user_id=current_user.user_id,
            patron_id=payload.patron_id,
            patron_type=payload.patron_type,
        )
        db.add(checkout)
        db.flush()  # so checkout.checkout_id exists before checkout_items

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

            if item.quantity is None or item.quantity < line.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Not enough stock for item {item.item_id} ({item.name}).",
                )

            # Reduce inventory quantity
            item.quantity -= line.quantity
            item.modified_by = current_user.user_id

            # Create movement record
            movement = InventoryMovement(
                item_id=item.item_id,
                user_id=current_user.user_id,
                quantity_change=-line.quantity,
                movement_type=MovementType.OUTBOUND,
                reason=f"Checkout #{checkout.checkout_id}",
                from_location_id=item.location_id,
                to_location_id=None,
            )
            db.add(movement)

            # Create checkout line item
            checkout_item = CheckoutItem(
                checkout_id=checkout.checkout_id,
                item_id=item.item_id,
                location_id=item.location_id,
                quantity=line.quantity,
            )
            db.add(checkout_item)

            total_quantity += line.quantity

        db.commit()
        db.refresh(checkout)

        return CheckoutCompleteResponse(
            checkout_id=checkout.checkout_id,
            item_count=len(payload.items),
            total_quantity=total_quantity,
            message="Checkout completed successfully.",
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Checkout failed: {str(e)}",
        )