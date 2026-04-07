"""One-time bootstrap endpoints for initializing a fresh deployment."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.bootstrap_schema import (
    BootstrapRequest,
    BootstrapResponse,
    BootstrapStatusResponse,
)
from app.services import bootstrap_service

router = APIRouter(prefix="/bootstrap", tags=["Bootstrap"])


@router.get("/status", response_model=BootstrapStatusResponse)
def get_bootstrap_status(db: Session = Depends(get_db)):
    """Report whether this deployment still requires bootstrap."""
    return BootstrapStatusResponse(
        bootstrap_required=bootstrap_service.is_bootstrap_required(db)
    )


@router.post("", response_model=BootstrapResponse, status_code=status.HTTP_201_CREATED)
def bootstrap_deployment(
    payload: BootstrapRequest,
):
    """Reset the database, rerun migrations, and apply bootstrap data."""
    result = bootstrap_service.reset_migrate_and_bootstrap(
        food_bank_name=payload.food_bank_name.strip(),
        food_bank_address=(payload.food_bank_address or "").strip() or None,
        location_name=payload.location_name.strip(),
        location_address=(payload.location_address or "").strip() or None,
        admin_email=payload.admin_email.strip().lower(),
        admin_name=payload.admin_name.strip(),
        include_dummy_inventory=payload.include_dummy_inventory,
        include_dummy_forecast_movements=payload.include_dummy_forecast_movements,
    )

    return BootstrapResponse(
        admin_email=result.admin_email,
        temporary_password=result.temporary_password,
        requires_password_change=result.requires_password_change,
        inserted_categories=result.inserted_categories,
        included_dummy_inventory=result.included_dummy_inventory,
        included_dummy_forecast_movements=result.included_dummy_forecast_movements,
    )
