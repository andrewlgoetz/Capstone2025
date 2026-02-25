from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    display_order: Optional[int] = 0

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    name: str
    description: Optional[str]
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime]
