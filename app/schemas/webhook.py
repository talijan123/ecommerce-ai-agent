"""
Pydantic Schemas for External Webhook Integrations (Shopify / WooCommerce).
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class OrderWebhookPayload(BaseModel):
    id: Optional[str] = None
    order_number: str
    email: str
    customer_name: Optional[str] = "Customer"
    financial_status: Optional[str] = "paid"
    fulfillment_status: Optional[str] = "unfulfilled"
    line_items: List[Dict[str, Any]] = Field(default_factory=list)
    total_price: float = 0.0
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    carrier: Optional[str] = None
    shipping_address: Optional[Dict[str, Any]] = None


class InventoryWebhookPayload(BaseModel):
    sku: str
    available: int
    product_id: Optional[str] = None
    size: Optional[str] = None


class WebhookResponse(BaseModel):
    success: bool
    message: str
    processed_at: str
