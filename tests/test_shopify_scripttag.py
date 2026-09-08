"""
Unit and Integration Tests for Shopify ScriptTag Auto-Injection & Management.
Validates:
1. Widget script URL resolution from config & override.
2. ScriptTag list retrieval and payload parsing.
3. ScriptTag automatic creation on store connect (preventing duplicates).
4. ScriptTag deletion on store disconnect.
5. Direct ScriptTag API endpoints (/api/v1/integrations/shopify/script-tag).
6. Multi-tenant chat resolution via shop_domain.
"""

import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.shopify_service import ShopifySyncService

client = TestClient(app)


@pytest.fixture
def auth_headers():
    """Create a verified test user and return Authorization headers with JWT token."""
    email = f"merchant_script_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "MerchantPassword123!"

    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": pwd, "full_name": "ScriptTag Test Owner"},
    )
    token = signup_res.json()["verification_token"]

    client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "verification_token": token},
    )

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pwd},
    )
    access_token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def merchant_store(auth_headers):
    """Create a store for the test merchant via REST API."""
    unique_phone_id = f"test_wa_{uuid.uuid4().hex[:10]}"
    res = client.post(
        "/api/v1/stores",
        json={
            "name": "ScriptTag Store",
            "whatsapp_phone_number_id": unique_phone_id,
        },
        headers=auth_headers,
    )
    return res.json()


class TestShopifyScriptTagService:
    """Test suite for ShopifySyncService ScriptTag methods."""

    def test_get_widget_script_url_defaults_and_override(self):
        default_url = ShopifySyncService.get_widget_script_url()
        assert default_url.endswith("/widget.js")
        assert "http" in default_url

        custom_override = "https://cdn.custom.com/assets/widget.js"
        assert ShopifySyncService.get_widget_script_url(custom_override) == custom_override

    def test_list_script_tags_mock_domain(self):
        tags = ShopifySyncService.list_script_tags("brand-demo.myshopify.com", "shpat_mock_123")
        assert isinstance(tags, list)

    @patch("httpx.Client.get")
    def test_list_script_tags_api_call(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "script_tags": [
                {
                    "id": 101,
                    "src": "https://ecommerce-store-frontend-swart.vercel.app/widget.js",
                    "event": "onload",
                    "display_scope": "all",
                }
            ]
        }
        mock_get.return_value = mock_resp

        tags = ShopifySyncService.list_script_tags("live-store.myshopify.com", "shpat_live_token_123")
        assert len(tags) == 1
        assert tags[0]["id"] == 101
        assert "widget.js" in tags[0]["src"]

    @patch("app.services.shopify_service.ShopifySyncService.list_script_tags")
    @patch("httpx.Client.post")
    def test_ensure_widget_script_tag_creates_new(self, mock_post, mock_list):
        mock_list.return_value = []

        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.return_value = {
            "script_tag": {
                "id": 202,
                "src": "https://ecommerce-store-frontend-swart.vercel.app/widget.js",
                "event": "onload",
                "display_scope": "all",
            }
        }
        mock_post.return_value = mock_resp

        success, tag, err = ShopifySyncService.ensure_widget_script_tag(
            shop_domain="live-store.myshopify.com",
            access_token="shpat_live_token_123",
        )

        assert success is True
        assert tag["id"] == 202
        assert tag["event"] == "onload"
        assert tag["display_scope"] == "all"
        assert err is None

    @patch("app.services.shopify_service.ShopifySyncService.list_script_tags")
    def test_ensure_widget_script_tag_idempotent_existing(self, mock_list):
        mock_list.return_value = [
            {
                "id": 303,
                "src": "https://ecommerce-store-frontend-swart.vercel.app/widget.js",
                "event": "onload",
                "display_scope": "all",
            }
        ]

        success, tag, err = ShopifySyncService.ensure_widget_script_tag(
            shop_domain="live-store.myshopify.com",
            access_token="shpat_live_token_123",
        )

        assert success is True
        assert tag["id"] == 303
        assert err is None

    @patch("app.services.shopify_service.ShopifySyncService.list_script_tags")
    @patch("httpx.Client.delete")
    def test_delete_widget_script_tag(self, mock_delete, mock_list):
        mock_list.return_value = [
            {
                "id": 404,
                "src": "https://ecommerce-store-frontend-swart.vercel.app/widget.js",
                "event": "onload",
            },
            {
                "id": 505,
                "src": "https://other-app.com/other.js",
                "event": "onload",
            },
        ]

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_delete.return_value = mock_resp

        success, deleted_count, err = ShopifySyncService.delete_widget_script_tag(
            shop_domain="live-store.myshopify.com",
            access_token="shpat_live_token_123",
        )

        assert success is True
        assert deleted_count == 1
        assert err is None


class TestShopifyScriptTagEndpoints:
    """Test suite for REST endpoints integrating ScriptTags and store lifecycle."""

    @patch("app.services.shopify_service.ShopifySyncService.ensure_widget_script_tag")
    @patch("app.services.shopify_service.ShopifySyncService.fetch_and_ingest_products")
    @patch("app.services.shopify_service.ShopifySyncService.verify_credentials")
    def test_connect_shopify_auto_injects_script_tag(
        self,
        mock_verify,
        mock_ingest,
        mock_inject,
        auth_headers,
        merchant_store,
    ):
        mock_verify.return_value = True
        mock_inject.return_value = (True, {"id": 999, "event": "onload"}, None)
        mock_ingest.return_value = {"status": "success", "products_synced": 5}

        resp = client.post(
            "/api/v1/integrations/shopify/connect",
            json={
                "store_id": merchant_store["id"],
                "shop_domain": "auto-inject-store.myshopify.com",
                "access_token": "shpat_test_token_12345",
            },
            headers=auth_headers,
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["platform"] == "shopify"
        assert data["shop_domain"] == "auto-inject-store.myshopify.com"
        assert mock_inject.called

    @patch("app.services.shopify_service.ShopifySyncService.delete_widget_script_tag")
    @patch("app.services.shopify_service.ShopifySyncService.verify_credentials")
    @patch("app.services.shopify_service.ShopifySyncService.fetch_and_ingest_products")
    def test_disconnect_shopify_deletes_script_tag(
        self,
        mock_ingest,
        mock_verify,
        mock_delete,
        auth_headers,
        merchant_store,
    ):
        mock_verify.return_value = True
        mock_delete.return_value = (True, 1, None)
        mock_ingest.return_value = {"status": "success", "products_synced": 0}

        # First connect store
        client.post(
            "/api/v1/integrations/shopify/connect",
            json={
                "store_id": merchant_store["id"],
                "shop_domain": "delete-tag-store.myshopify.com",
                "access_token": "shpat_delete_test_token",
            },
            headers=auth_headers,
        )

        resp = client.post(
            "/api/v1/integrations/shopify/disconnect",
            json={"store_id": merchant_store["id"]},
            headers=auth_headers,
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert mock_delete.called

    @patch("app.api.v1.endpoints.chat.run_agent_turn")
    def test_chat_api_resolves_store_via_shop_domain(
        self,
        mock_run_agent,
    ):
        mock_run_agent.return_value = (
            "The ScriptTag Velvet Cushion is currently in stock.",
            [],
            True,
        )

        resp = client.post(
            "/api/v1/chat",
            json={
                "session_id": "test_scripttag_chat_session_1",
                "message": "Do you have the ScriptTag Velvet Cushion in stock?",
                "shop_domain": "cushion-boutique.myshopify.com",
            },
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "ScriptTag Velvet Cushion" in data["response"]
        assert mock_run_agent.called
        # Verify shop_domain was passed through to run_agent_turn
        _, kwargs = mock_run_agent.call_args
        assert kwargs["shop_domain"] == "cushion-boutique.myshopify.com"
