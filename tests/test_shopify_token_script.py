"""
Unit and Integration Tests for scripts/get_shopify_token.py and pure multi-tenant Shopify integration.
Validates client credentials exchange, error handling, database upsert (without .env writes),
and independent multi-tenant store isolation.
"""

import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.integration import StoreIntegration
from app.models.product import Product
from app.models.order import Order
from app.services.ecommerce_service import EcommerceService
from scripts.get_shopify_token import (
    mask_token,
    exchange_client_credentials,
    resolve_target_store,
    save_integration_and_sync,
)


def test_mask_token():
    assert mask_token("") == "<None>"
    assert mask_token("short") == "***"
    token = "shpat_1234567890abcdef123456"
    masked = mask_token(token)
    assert masked.startswith("shpat_")
    assert masked.endswith(f" (length: {len(token)})")


@patch("httpx.Client.post")
def test_exchange_client_credentials_success(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "access_token": "shpat_abc123mocktoken456",
        "scope": "read_products,write_products,read_orders",
    }
    mock_post.return_value = mock_resp

    token, raw_json, err = exchange_client_credentials(
        shop_domain="yqcncc-b0.myshopify.com",
        client_id="custom_client_id",
        client_secret="custom_client_secret",
    )

    assert err is None
    assert token == "shpat_abc123mocktoken456"
    assert raw_json["scope"] == "read_products,write_products,read_orders"


@patch("httpx.Client.post")
def test_exchange_client_credentials_failure(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.reason_phrase = "Unauthorized"
    mock_resp.json.return_value = {"error": "invalid_client", "error_description": "Client authentication failed"}
    mock_post.return_value = mock_resp

    token, raw_json, err = exchange_client_credentials(
        shop_domain="yqcncc-b0.myshopify.com",
        client_id="bad_client_id",
        client_secret="bad_client_secret",
    )

    assert token is None
    assert raw_json is None
    assert "401" in err


def test_resolve_target_store_and_save_integration():
    ensure_db_initialized()
    db = SessionLocal()

    try:
        # Create a test store
        unique_email = f"test_shopify_{uuid.uuid4().hex[:8]}@example.com"
        test_store = Store(
            name="YQCNCC Test Store",
            owner_email=unique_email,
            whatsapp_phone_number_id=f"1555{uuid.uuid4().int % 10000000:07d}",
            is_active=True,
        )
        db.add(test_store)
        db.commit()
        db.refresh(test_store)

        # Resolve store
        resolved = resolve_target_store(db, str(test_store.id), "yqcncc-b0.myshopify.com")
        assert resolved.id == test_store.id

        # Save integration and sync with test token (purely in DB)
        result = save_integration_and_sync(
            shop_domain="yqcncc-b0.myshopify.com",
            access_token="shpat_test_mock_token_999",
            client_id="client_id_123",
            store_id=str(test_store.id),
            skip_sync=False,
        )

        assert result["success"] is True
        assert result["shop_domain"] == "yqcncc-b0.myshopify.com"
        assert result["store_id"] == str(test_store.id)

        # Check DB record
        integration = (
            db.query(StoreIntegration)
            .filter(StoreIntegration.store_id == test_store.id, StoreIntegration.platform == "shopify")
            .first()
        )
        assert integration is not None
        assert integration.shop_domain == "yqcncc-b0.myshopify.com"
        assert integration.access_token == "shpat_test_mock_token_999"
        assert integration.sync_status == "synced"
        assert integration.products_synced_count > 0

        # Products were ingested under test_store.id
        products = db.query(Product).filter(Product.store_id == test_store.id).all()
        assert len(products) > 0

    finally:
        # Cleanup test data
        try:
            db.query(Product).filter(Product.store_id == test_store.id).delete()
            db.query(StoreIntegration).filter(StoreIntegration.store_id == test_store.id).delete()
            db.query(Store).filter(Store.id == test_store.id).delete()
            db.commit()
        except Exception:
            pass
        db.close()


def test_multi_tenant_shopify_isolation():
    """
    Verify that Store A and Store B can have separate Shopify configurations,
    separate tokens, and separate catalogs in database without crosstalk or global env leakage.
    """
    ensure_db_initialized()
    db = SessionLocal()

    store_a = None
    store_b = None

    try:
        # 1. Create Store A (e.g. Apparel Store)
        store_a = Store(
            name="Store A Apparel",
            owner_email=f"store_a_{uuid.uuid4().hex[:6]}@example.com",
            whatsapp_phone_number_id=f"1555{uuid.uuid4().int % 10000000:07d}",
            is_active=True,
        )
        # 2. Create Store B (e.g. Electronics Store)
        store_b = Store(
            name="Store B Electronics",
            owner_email=f"store_b_{uuid.uuid4().hex[:6]}@example.com",
            whatsapp_phone_number_id=f"1555{uuid.uuid4().int % 10000000:07d}",
            is_active=True,
        )
        db.add_all([store_a, store_b])
        db.commit()
        db.refresh(store_a)
        db.refresh(store_b)

        # 3. Save Store A Integration
        save_integration_and_sync(
            shop_domain="store-a-apparel.myshopify.com",
            access_token="shpat_token_store_a_111",
            client_id="client_a_111",
            store_id=str(store_a.id),
            skip_sync=False,
        )

        # 4. Save Store B Integration
        save_integration_and_sync(
            shop_domain="store-b-electronics.myshopify.com",
            access_token="shpat_token_store_b_222",
            client_id="client_b_222",
            store_id=str(store_b.id),
            skip_sync=False,
        )

        # 5. Verify Store A and Store B records in database are strictly isolated
        integ_a = db.query(StoreIntegration).filter(StoreIntegration.store_id == store_a.id).first()
        integ_b = db.query(StoreIntegration).filter(StoreIntegration.store_id == store_b.id).first()

        assert integ_a is not None
        assert integ_b is not None
        assert integ_a.shop_domain == "store-a-apparel.myshopify.com"
        assert integ_a.access_token == "shpat_token_store_a_111"
        assert integ_b.shop_domain == "store-b-electronics.myshopify.com"
        assert integ_b.access_token == "shpat_token_store_b_222"
        assert integ_a.access_token != integ_b.access_token

        # 6. Verify EcommerceService credentials resolution per store
        ecom = EcommerceService()
        domain_a, token_a = ecom._get_store_credentials(store_id=store_a.id, db=db)
        domain_b, token_b = ecom._get_store_credentials(store_id=store_b.id, db=db)

        assert domain_a == "store-a-apparel.myshopify.com"
        assert token_a == "shpat_token_store_a_111"
        assert domain_b == "store-b-electronics.myshopify.com"
        assert token_b == "shpat_token_store_b_222"

        # 7. Verify product isolation
        prods_a = db.query(Product).filter(Product.store_id == store_a.id).all()
        prods_b = db.query(Product).filter(Product.store_id == store_b.id).all()
        assert len(prods_a) > 0
        assert len(prods_b) > 0
        for p in prods_a:
            assert p.store_id == store_a.id
        for p in prods_b:
            assert p.store_id == store_b.id

    finally:
        try:
            if store_a:
                db.query(Product).filter(Product.store_id == store_a.id).delete()
                db.query(StoreIntegration).filter(StoreIntegration.store_id == store_a.id).delete()
                db.query(Store).filter(Store.id == store_a.id).delete()
            if store_b:
                db.query(Product).filter(Product.store_id == store_b.id).delete()
                db.query(StoreIntegration).filter(StoreIntegration.store_id == store_b.id).delete()
                db.query(Store).filter(Store.id == store_b.id).delete()
            db.commit()
        except Exception:
            pass
        db.close()


def test_shopify_connect_endpoint_with_client_credentials():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token
    from app.models.user import User

    client = TestClient(app)
    ensure_db_initialized()
    db = SessionLocal()

    try:
        # Find or create merchant user and store
        user = db.query(User).filter(User.email == "admin@autocommerce.ai").first()
        if not user:
            user = db.query(User).first()
        assert user is not None

        store = db.query(Store).filter(Store.is_active == True).first()
        assert store is not None

        token = create_access_token({"sub": str(user.id), "email": str(user.email)})
        headers = {"Authorization": f"Bearer {token}"}

        # Connect with client_id and client_secret (using test credentials)
        payload = {
            "store_id": str(store.id),
            "shop_domain": "brand-demo.myshopify.com",
            "client_id": "test_client_id_abc",
            "client_secret": "test_client_secret_xyz",
        }

        resp = client.post("/api/v1/integrations/shopify/connect", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["platform"] == "shopify"
        assert data["shop_domain"] == "brand-demo.myshopify.com"
        assert data["sync_status"] == "synced"
        assert data["products_synced_count"] >= 5
    finally:
        db.close()


def test_shopify_disconnect_and_clear_catalog_endpoints():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.security import create_access_token
    from app.models.user import User

    client = TestClient(app)
    ensure_db_initialized()
    db = SessionLocal()

    store = None
    try:
        user = db.query(User).first()
        assert user is not None

        # Create temporary store
        store = Store(
            owner_id=user.id,
            owner_email=user.email,
            name="Disconnect Test Store",
            whatsapp_phone_number_id=f"test_phone_{uuid.uuid4().hex[:8]}",
            is_active=True,
        )
        db.add(store)
        db.commit()
        db.refresh(store)

        token = create_access_token({"sub": str(user.id), "email": str(user.email)})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Shopify StoreIntegration record
        integ = StoreIntegration(
            store_id=store.id,
            platform="shopify",
            shop_domain="temp-disconnect-store.myshopify.com",
            access_token="shpat_temp_token_123",
            sync_status="connected",
            products_synced_count=2,
        )
        db.add(integ)
        db.commit()

        # Verify integration exists
        integ_check = db.query(StoreIntegration).filter(StoreIntegration.store_id == store.id, StoreIntegration.platform == "shopify").first()
        assert integ_check is not None

        # 2. Add dummy products
        p1 = Product(store_id=store.id, sku=f"SKU-DISC-1-{uuid.uuid4().hex[:6]}", title="Item 1", category="Apparel", price=29.99, stock_quantity=10)
        p2 = Product(store_id=store.id, sku=f"SKU-DISC-2-{uuid.uuid4().hex[:6]}", title="Item 2", category="Apparel", price=49.99, stock_quantity=20)
        db.add_all([p1, p2])
        db.commit()

        # 3. Test Clear Catalog endpoint (POST and DELETE)
        clear_resp = client.post("/api/v1/integrations/catalog/clear", json={"store_id": str(store.id)}, headers=headers)
        assert clear_resp.status_code == 200
        clear_data = clear_resp.json()
        assert clear_data["success"] is True
        assert clear_data["deleted_count"] >= 2

        # Verify products wiped
        prods_remaining = db.query(Product).filter(Product.store_id == store.id).all()
        assert len(prods_remaining) == 0

        # 4. Test Disconnect Shopify endpoint (POST and DELETE)
        disc_resp = client.post("/api/v1/integrations/shopify/disconnect", json={"store_id": str(store.id)}, headers=headers)
        assert disc_resp.status_code == 200
        disc_data = disc_resp.json()
        assert disc_data["success"] is True

        # Verify integration removed
        integ_after = db.query(StoreIntegration).filter(StoreIntegration.store_id == store.id, StoreIntegration.platform == "shopify").first()
        assert integ_after is None

    finally:
        if store:
            db.query(Product).filter(Product.store_id == store.id).delete()
            db.query(StoreIntegration).filter(StoreIntegration.store_id == store.id).delete()
            db.query(Store).filter(Store.id == store.id).delete()
            db.commit()
        db.close()
