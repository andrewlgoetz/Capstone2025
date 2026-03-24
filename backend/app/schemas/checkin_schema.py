from typing import List, Optional
from pydantic import BaseModel, Field


class CheckinItemRequest(BaseModel):
    item_id: int
    location_id: Optional[int] = None
    quantity: int = Field(..., gt=0)


class CheckinCompleteRequest(BaseModel):
    donor_name: str
    donor_type: Optional[str] = None
    items: List[CheckinItemRequest]


class CheckinCompleteResponse(BaseModel):
    checkin_id: int
    item_count: int
    total_quantity: int
    message: str