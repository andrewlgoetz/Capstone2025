from typing import List, Optional
from pydantic import BaseModel, Field


class CheckoutItemRequest(BaseModel):
    item_id: int
    location_id: Optional[int] = None
    quantity: int = Field(..., gt=0)


class CheckoutCompleteRequest(BaseModel):
    patron_id: str
    patron_type: Optional[str] = None
    items: List[CheckoutItemRequest]


class CheckoutCompleteResponse(BaseModel):
    checkout_id: int
    item_count: int
    total_quantity: int
    message: str