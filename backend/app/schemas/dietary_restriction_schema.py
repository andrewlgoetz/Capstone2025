from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class DietaryRestrictionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None  # hex e.g. "#22c55e"


class DietaryRestrictionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = None
    is_active: Optional[bool] = None


class DietaryRestrictionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_preset: bool
    preset_type: Optional[str]
    color: Optional[str]
    is_active: bool
    created_at: datetime
