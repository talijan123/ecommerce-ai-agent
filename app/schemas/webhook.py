"""
Pydantic Schemas for External Webhook Integrations (Shopify / WooCommerce).
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class OrderWebhookPayload(BaseModel):
    id: Optional[str] = None
    order_number: str
    email: Optional[str] = None
    customer_name: Optional[str] = "Customer"
    customer_phone: Optional[str] = None
    phone: Optional[str] = None
    financial_status: Optional[str] = "paid"
    fulfillment_status: Optional[str] = "unfulfilled"
    status: Optional[str] = None
    line_items: List[Dict[str, Any]] = Field(default_factory=list)
    total_price: float = 0.0
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    carrier: Optional[str] = None
    shipping_address: Optional[Any] = None


class CartWebhookPayload(BaseModel):
    id: Optional[str] = None
    cart_token: Optional[str] = None
    token: Optional[str] = None
    session_id: Optional[str] = None
    email: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = "Valued Customer"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    customer_phone: Optional[str] = None
    phone: Optional[str] = None
    line_items: List[Dict[str, Any]] = Field(default_factory=list)
    items: List[Dict[str, Any]] = Field(default_factory=list)
    abandoned_checkout_url: Optional[str] = None
    cart_url: Optional[str] = None
    checkout_url: Optional[str] = None
    total_price: Optional[float] = 0.0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class InventoryWebhookPayload(BaseModel):
    sku: str
    available: int
    product_id: Optional[str] = None
    size: Optional[str] = None


class WebhookResponse(BaseModel):
    success: bool
    message: str
    processed_at: str
    data: Optional[Dict[str, Any]] = None

