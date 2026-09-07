"""
Pydantic Schemas for Store Integrations (Shopify, WooCommerce, Custom API).
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class ShopifyConnectRequest(BaseModel):
    store_id: str = Field(..., description="Target Store UUID")
    shop_domain: str = Field(..., description="Shopify store domain, e.g. brand.myshopify.com")
    client_id: Optional[str] = Field(None, description="Shopify App Client ID / API Key for OAuth Client Credentials")
    client_secret: Optional[str] = Field(None, description="Shopify App Client Secret for OAuth Client Credentials")
    access_token: Optional[str] = Field(None, description="Shopify Admin API Access Token (shpat_...) [Legacy]")
    api_key: Optional[str] = Field(None, description="Shopify API Key / App Client ID")


class WooCommerceConnectRequest(BaseModel):
    store_id: str = Field(..., description="Target Store UUID")
    shop_domain: Optional[str] = Field(None, description="WooCommerce store URL, e.g. https://mystore.com")
    store_url: Optional[str] = Field(None, description="Alias for WooCommerce store URL")
    consumer_key: Optional[str] = Field(None, description="WooCommerce Consumer Key (ck_...)")
    consumer_secret: Optional[str] = Field(None, description="WooCommerce Consumer Secret (cs_...)")

    @model_validator(mode="before")
    @classmethod
    def resolve_store_url(cls, data: Any) -> Any:
        if isinstance(data, dict):
            url = data.get("store_url") or data.get("shop_domain")
            if url:
                data["shop_domain"] = url
                data["store_url"] = url
            elif "shop_domain" not in data and "store_url" not in data:
                raise ValueError("WooCommerce store URL (shop_domain or store_url) is required.")
        return data


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
