"""
Pydantic Schemas for Store Integrations (Shopify, WooCommerce, Custom API).
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ShopifyConnectRequest(BaseModel):
    store_id: str = Field(..., description="Target Store UUID")
    shop_domain: str = Field(..., description="Shopify store domain, e.g. brand.myshopify.com")
    access_token: Optional[str] = Field(None, description="Shopify Admin API Access Token (shpat_...)")
    api_key: Optional[str] = Field(None, description="Shopify API Key / App Client ID")


class WooCommerceConnectRequest(BaseModel):
    store_id: str = Field(..., description="Target Store UUID")
    shop_domain: str = Field(..., description="WooCommerce store URL, e.g. https://mystore.com")
    consumer_key: Optional[str] = Field(None, description="WooCommerce Consumer Key (ck_...)")
    consumer_secret: Optional[str] = Field(None, description="WooCommerce Consumer Secret (cs_...)")


class SyncStoreRequest(BaseModel):
    store_id: str = Field(..., description="Target Store UUID")
    sample_catalog: Optional[bool] = Field(False, description="Whether to ingest standard demo catalog if live API key is pending")


class IntegrationResponse(BaseModel):
    id: str
    store_id: str
    platform: str
    shop_domain: Optional[str] = None
    sync_status: str
    products_synced_count: int
    last_synced_at: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class SyncResultResponse(BaseModel):
    success: bool
    platform: str
    store_id: str
    products_synced: int
    sync_status: str
    message: str
    sample_products: Optional[List[Dict[str, Any]]] = None
