"""
Unit and Integration Tests for scripts/get_shopify_token.py.
Validates client credentials exchange, error handling, database upsert,
and Shopify catalog synchronization workflow.
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
from scripts.get_shopify_token import (
    mask_token,
    update_env_file,
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


def test_update_env_file(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("SOME_VAR=hello\nSHOPIFY_STORE_URL=old.myshopify.com\n", encoding="utf-8")

    res = update_env_file("yqcncc-b0.myshopify.com", "shpat_test_token_123", env_path=str(env_file))
    assert res is True

    content = env_file.read_text(encoding="utf-8")
    assert "SHOPIFY_STORE_URL=yqcncc-b0.myshopify.com" in content
    assert "SHOPIFY_ACCESS_TOKEN=shpat_test_token_123" in content
    assert "SOME_VAR=hello" in content


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
        client_id="test_client_id",
        client_secret="test_client_secret",
    )

    assert err is None
    assert token == "shpat_abc123mocktoken456"
    assert raw_json["scope"] == "read_products,write_products,read_orders"


@patch("httpx.Client.post")
def test_exchange_client_credentials_failure(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.reason_phrase = "Unauthorized"
    mock_resp.text = '{"error": "invalid_client", "error_description": "Client authentication failed"}'
    mock_post.return_value = mock_resp

    token, raw_json, err = exchange_client_credentials(
        shop_domain="yqcncc-b0.myshopify.com",
        client_id="bad_client_id",
        client_secret="bad_client_secret",
    )

    assert token is None
    assert raw_json is None
    assert "401" in err


def test_resolve_target_store_and_save_integration(tmp_path):
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

        # Save integration and sync with test token
        mock_env = tmp_path / ".env"
        with patch("scripts.get_shopify_token.update_env_file", return_value=True):
            result = save_integration_and_sync(
                shop_domain="yqcncc-b0.myshopify.com",
                access_token="shpat_test_mock_token_999",
                client_id="client_id_123",
                store_id=str(test_store.id),
                skip_sync=False,
                update_env=False,
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

            # Products were ingested
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
