"""
Pydantic Schemas for Orders and Fulfillment.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class OrderItemSchema(BaseModel):
    product_id: Optional[str] = None
    sku: Optional[str] = None
    name: str
    size: Optional[str] = None
    quantity: int = 1
    price: float


class OrderBase(BaseModel):
    order_number: str
    customer_name: str
    customer_email: str
    status: str
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    estimated_delivery: Optional[str] = None
    items: List[Dict[str, Any]] = Field(default_factory=list)
    total_amount: float
    shipping_address: Optional[str] = None
    cancellation_reason: Optional[str] = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}
