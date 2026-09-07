"""
Direct Store Integrations Endpoints (/api/v1/integrations).
Supports connecting Shopify and WooCommerce stores, ingesting live catalog feeds,
and tracking continuous sync status per merchant store tenant.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.store import Store
from app.models.product import Product
from app.models.integration import StoreIntegration
from app.schemas.integration import (
    ShopifyConnectRequest,
    WooCommerceConnectRequest,
    SyncStoreRequest,
    IntegrationResponse,
    SyncResultResponse,
)

from app.services.shopify_service import ShopifySyncService
from app.services.woocommerce_service import WooCommerceSyncService

router = APIRouter()


def _get_user_store(store_id_str: str, db: Session, current_user: User) -> Store:
    try:
        parsed_id = uuid.UUID(str(store_id_str))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid store ID format '{store_id_str}'. Must be a valid UUID.",
        )

    if getattr(current_user, "role", "merchant") == "super_admin":
        store = db.query(Store).filter(Store.id == parsed_id).first()
    else:
        store = (
            db.query(Store)
            .filter(
                Store.id == parsed_id,
                or_(Store.owner_id == current_user.id, Store.owner_email == current_user.email),
            )
            .first()
        )
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store '{store_id_str}' not found or access denied.",
        )
    return store


# Sample starter catalog when syncing WooCommerce store in demo/initial mode
SAMPLE_SHOPIFY_CATALOG = [
    {
        "title": "Minimalist Ceramic Desk Lamp",
        "category": "Home & Decor",
        "price": 49.99,
        "stock": 35,
        "sku": "SHPF-LMP-001",
        "description": "Handcrafted matte ceramic table lamp with warm ambient LED bulb.",
        "sizes": [{"size": "Standard", "stock": 35}],
    },
    {
        "title": "Oversized Heavyweight Cotton Hoodie",
        "category": "Apparel",
        "price": 68.00,
        "stock": 50,
        "sku": "SHPF-HOD-002",
        "description": "450 GSM French terry cotton pullover hoodie with relaxed streetwear silhouette.",
        "sizes": [
            {"size": "S", "stock": 10},
            {"size": "M", "stock": 15},
            {"size": "L", "stock": 15},
            {"size": "XL", "stock": 10},
        ],
    },
    {
        "title": "Heritage Leather Cardholder Wallet",
        "category": "Accessories",
        "price": 34.50,
        "stock": 40,
        "sku": "SHPF-WLT-003",
        "description": "Full-grain vegetable-tanned Italian leather wallet with 6 card slots.",
        "sizes": [{"size": "Standard", "stock": 40}],
    },
    {
        "title": "Cloudfoam Performance Running Shoes",
        "category": "Footwear",
        "price": 110.00,
        "stock": 28,
        "sku": "SHPF-SHO-004",
        "description": "Ultra-lightweight breathable mesh trainers with high-rebound cushioning.",
        "sizes": [
            {"size": "8", "stock": 6},
            {"size": "9", "stock": 8},
            {"size": "10", "stock": 8},
            {"size": "11", "stock": 6},
        ],
    },
    {
        "title": "Amber & Smoked Cedar Eau de Parfum 50ml",
        "category": "Fragrance",
        "price": 85.00,
        "stock": 20,
        "sku": "SHPF-FRG-005",
        "description": "Niche artisan fragrance infused with rich agarwood, smoked vetiver, and golden amber.",
        "sizes": [{"size": "50ml", "stock": 20}],
    },
]


@router.post(
    "/shopify/connect",
    response_model=IntegrationResponse,
    summary="Connect a Shopify store domain using Client Credentials or Access Token",
)
def connect_shopify(
    payload: ShopifyConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect a merchant's Shopify store:
    - Normalizes shop domain (e.g. brand.myshopify.com)
    - If Client ID & Client Secret are provided without access token:
      exchanges them via OAuth / Client Credentials endpoint
    - Verifies credentials against Shopify Admin REST API
    - Saves or updates StoreIntegration record
    - Triggers immediate product catalog ingestion
    """
    store = _get_user_store(payload.store_id, db, current_user)
    clean_domain = ShopifySyncService.clean_shop_domain(payload.shop_domain)
    if not clean_domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Shopify domain. Please provide a valid store domain (e.g. brand.myshopify.com).",
        )

    resolved_client_id = payload.client_id or payload.api_key
    resolved_client_secret = payload.client_secret
    access_token = payload.access_token

    # 1. If Client ID & Client Secret are provided, exchange them for an Admin API access token
    if resolved_client_id and resolved_client_secret and not access_token:
        exchanged_token, raw_resp, err_msg = ShopifySyncService.exchange_client_credentials(
            clean_domain, resolved_client_id, resolved_client_secret
        )
        if not exchanged_token:
            detail_msg = f"Failed to exchange Shopify credentials for store '{clean_domain}': {err_msg}"
            if "application_cannot_be_found" in (err_msg or ""):
                detail_msg = (
                    f"Shopify App with Client ID '{resolved_client_id}' not found or not installed on '{clean_domain}'. "
                    "Please verify your Shopify Partner/Dev Dashboard app settings and ensure it is installed on the store."
                )
            elif "invalid_client" in (err_msg or ""):
                detail_msg = (
                    f"Invalid Client Secret for Shopify App '{resolved_client_id}'. "
                    "Please double-check the secret in your Shopify Partner/Dev Dashboard."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail_msg,
            )
        access_token = exchanged_token

    # 2. Validate token/credentials
    if access_token:
        is_valid = ShopifySyncService.verify_credentials(clean_domain, access_token)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with Shopify store '{clean_domain}'. Please check your credentials or Admin API access token.",
            )

    integration = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.store_id == store.id,
            StoreIntegration.platform == "shopify",
        )
        .first()
    )

    if not integration:
        integration = StoreIntegration(
            store_id=store.id,
            platform="shopify",
            shop_domain=clean_domain,
            access_token=access_token,
            api_key=resolved_client_id,
            sync_status="connected",
            products_synced_count=0,
        )
        db.add(integration)
    else:
        integration.shop_domain = clean_domain
        if access_token:
            integration.access_token = access_token
        if resolved_client_id:
            integration.api_key = resolved_client_id
        integration.sync_status = "connected"
        integration.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(integration)

    # 3. Immediately ingest products
    try:
        ShopifySyncService.fetch_and_ingest_products(
            db=db,
            store_id=str(store.id),
            shop_domain=clean_domain,
            access_token=access_token,
        )
        db.refresh(integration)
    except Exception as e:
        print(f"[ERROR] Shopify auto-sync failed during connect: {e}")

    return integration.to_dict()


@router.post(
    "/shopify/sync",
    response_model=SyncResultResponse,
    summary="Ingest products from Shopify into store catalog",
)
def sync_shopify_catalog(
    payload: SyncStoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync products from connected Shopify store into merchant's product catalog:
    - Fetches live products from Shopify Admin REST API
    - Ingests & upserts items into database with SKUs, variant breakdowns, and prices
    - Updates StoreIntegration record with synced item count and timestamp
    """
    store = _get_user_store(payload.store_id, db, current_user)

    integration = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.store_id == store.id,
            StoreIntegration.platform == "shopify",
        )
        .first()
    )

    domain = integration.shop_domain if integration and integration.shop_domain else f"{store.name.lower().replace(' ', '-')}.myshopify.com"
    token = integration.access_token if integration and integration.access_token else None

    result = ShopifySyncService.fetch_and_ingest_products(
        db=db,
        store_id=str(store.id),
        shop_domain=domain,
        access_token=token,
    )

    return result


@router.post(
    "/woocommerce/connect",
    response_model=IntegrationResponse,
    summary="Connect a WooCommerce store URL and REST API keys",
)
def connect_woocommerce(
    payload: WooCommerceConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Connect a merchant's WooCommerce store with REST credentials.
    - Normalizes store URL
    - Verifies credentials against WooCommerce REST API (/wp-json/wc/v3/system_status)
    - Saves or updates StoreIntegration record
    - Triggers immediate product catalog ingestion
    """
    store = _get_user_store(payload.store_id, db, current_user)
    raw_url = payload.store_url or payload.shop_domain or ""
    clean_url = WooCommerceSyncService.clean_store_url(raw_url)

    if not clean_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid WooCommerce store URL. Please provide a valid URL (e.g. https://mystore.com).",
        )

    # 1. Verify credentials if consumer_key and consumer_secret are provided
    if payload.consumer_key and payload.consumer_secret:
        is_valid, err_msg = WooCommerceSyncService.verify_credentials(
            clean_url, payload.consumer_key, payload.consumer_secret
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to authenticate with WooCommerce store '{clean_url}': {err_msg}",
            )

    # 2. Save or update StoreIntegration record
    integration = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.store_id == store.id,
            StoreIntegration.platform == "woocommerce",
        )
        .first()
    )

    if not integration:
        integration = StoreIntegration(
            store_id=store.id,
            platform="woocommerce",
            shop_domain=clean_url,
            api_key=payload.consumer_key,
            access_token=payload.consumer_secret,
            sync_status="connected",
            products_synced_count=0,
        )
        db.add(integration)
    else:
        integration.shop_domain = clean_url
        if payload.consumer_key:
            integration.api_key = payload.consumer_key
        if payload.consumer_secret:
            integration.access_token = payload.consumer_secret
        integration.sync_status = "connected"
        integration.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(integration)

    # 3. Immediately ingest products
    try:
        WooCommerceSyncService.fetch_and_ingest_products(
            db=db,
            store_id=str(store.id),
            store_url=clean_url,
            consumer_key=payload.consumer_key,
            consumer_secret=payload.consumer_secret,
        )
        db.refresh(integration)
    except Exception as e:
        print(f"[ERROR] WooCommerce auto-sync failed during connect: {e}")

    return integration.to_dict()


@router.post(
    "/woocommerce/sync",
    response_model=SyncResultResponse,
    summary="Ingest products from WooCommerce into store catalog",
)
def sync_woocommerce_catalog(
    payload: SyncStoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync catalog products from WooCommerce store:
    - Fetches live products from WooCommerce REST API (/wp-json/wc/v3/products)
    - Ingests & upserts items into database with SKUs, variant breakdowns, categories, and prices
    - Updates StoreIntegration record with synced item count and timestamp
    """
    store = _get_user_store(payload.store_id, db, current_user)

    integration = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.store_id == store.id,
            StoreIntegration.platform == "woocommerce",
        )
        .first()
    )

    store_url = integration.shop_domain if integration and integration.shop_domain else f"https://{store.name.lower().replace(' ', '')}-store.com"
    consumer_key = integration.api_key if integration else None
    consumer_secret = integration.access_token if integration else None

    result = WooCommerceSyncService.fetch_and_ingest_products(
        db=db,
        store_id=str(store.id),
        store_url=store_url,
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
    )

    return result



@router.get(
    "/{store_id}",
    response_model=List[IntegrationResponse],
    summary="List active direct store integrations for a store tenant",
)
def list_store_integrations(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve all platform integrations configured for the store.
    """
    store = _get_user_store(store_id, db, current_user)
    integrations = (
        db.query(StoreIntegration)
        .filter(StoreIntegration.store_id == store.id)
        .order_by(StoreIntegration.created_at.desc())
        .all()
    )
    return [i.to_dict() for i in integrations]
