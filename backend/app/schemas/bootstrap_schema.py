"""Schemas for one-time deployment bootstrap."""

from pydantic import BaseModel, EmailStr, Field


class BootstrapRequest(BaseModel):
    """Payload for initializing a fresh deployment."""

    food_bank_name: str = Field(..., min_length=1)
    food_bank_address: str | None = None
    location_name: str = Field(default="Main Warehouse", min_length=1)
    location_address: str | None = None
    admin_email: EmailStr
    admin_name: str = Field(..., min_length=1)
    include_dummy_inventory: bool = False
    include_dummy_forecast_movements: bool = False


class BootstrapStatusResponse(BaseModel):
    """Expose whether bootstrap is still available."""

    bootstrap_required: bool


class BootstrapResponse(BaseModel):
    """Response returned when bootstrap succeeds."""

    admin_email: EmailStr
    temporary_password: str
    requires_password_change: bool
    inserted_categories: int
    included_dummy_inventory: bool = False
    included_dummy_forecast_movements: bool = False
    message: str = "Bootstrap completed successfully"
