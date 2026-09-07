"""
Comprehensive Mock Test Suite for WooCommerce Integration Pipeline.

Verifies:
1. WooCommerce REST API credential verification against /wp-json/wc/v3/system_status.
2. Immediate WooCommerce product catalog ingestion from /wp-json/wc/v3/products.
3. Database persistence and multi-tenant scoping in PostgreSQL (StoreIntegration & Product tables).
4. Error handling and credential rejection on 401 Unauthorized responses.
5. AI Agent & db_tools (check_product_stock) integration and tenant isolation for ingested WooCommerce products.
"""

import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.product import Product
from app.models.integration import StoreIntegration
from app.services.woocommerce_service import WooCommerceSyncService
from app.services.db_tools import check_product_stock, execute_db_tool
from app.services.ai_support_service import AISupportService, ai_support_service
from tests.test_auth import create_and_verify_user

client = TestClient(app)

MOCK_STORE_URL = "https://mock-woo-store.com"
MOCK_CK = "ck_test123"
MOCK_CS = "cs_test456"

# Realistic WooCommerce REST API Products Payload (wc/v3)
MOCK_WOOCOMMERCE_PRODUCTS_PAYLOAD = [
    {
        "id": 794,
        "name": "Woo Premium Leather Jacket",
        "slug": "woo-premium-leather-jacket",
        "permalink": "https://mock-woo-store.com/product/woo-premium-leather-jacket",
        "type": "simple",
        "status": "publish",
        "featured": False,
        "description": "<p>Handcrafted genuine leather jacket with quilted lining and brass zippers.</p>\n",
        "short_description": "<p>Premium genuine leather jacket.</p>\n",
        "sku": "WOO-JKT-001",
        "price": "199.99",
        "regular_price": "249.99",
        "sale_price": "199.99",
        "manage_stock": True,
        "stock_quantity": 42,
        "stock_status": "instock",
        "categories": [
            {"id": 15, "name": "Apparel", "slug": "apparel"},
            {"id": 18, "name": "Outerwear", "slug": "outerwear"},
        ],
        "images": [
            {
                "id": 1021,
                "src": "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600",
                "name": "Leather Jacket Front",
                "alt": "Front view of leather jacket",
            }
        ],
        "attributes": [
            {
                "id": 1,
                "name": "Size",
                "options": ["S", "M", "L", "XL"],
            }
        ],
    },
    {
        "id": 795,
        "name": "Ergonomic Wireless Mechanical Keyboard",
        "slug": "ergonomic-wireless-mechanical-keyboard",
        "permalink": "https://mock-woo-store.com/product/ergonomic-wireless-keyboard",
        "type": "simple",
        "status": "publish",
        "featured": True,
        "description": "<p>RGB backlit mechanical keyboard with hot-swappable tactile switches.</p>\n",
        "short_description": "<p>Wireless mechanical keyboard.</p>\n",
        "sku": "WOO-KBD-002",
        "price": "129.50",
        "regular_price": "129.50",
        "sale_price": "",
        "manage_stock": True,
        "stock_quantity": 25,
        "stock_status": "instock",
        "categories": [
            {"id": 22, "name": "Electronics", "slug": "electronics"}
        ],
        "images": [
            {
                "id": 1022,
                "src": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600",
                "name": "Keyboard",
                "alt": "Wireless mechanical keyboard",
            }
        ],
        "attributes": [],
    },
    {
        "id": 796,
        "name": "Artisan Roast Organic Coffee Beans 1kg",
        "slug": "artisan-roast-organic-coffee-beans",
        "permalink": "https://mock-woo-store.com/product/artisan-roast-coffee",
        "type": "simple",
        "status": "publish",
        "featured": False,
        "description": "<p>Single-origin fair-trade whole bean arabica coffee roasted with rich dark chocolate notes.</p>\n",
        "short_description": "<p>Freshly roasted organic coffee beans.</p>\n",
        "sku": "WOO-COF-003",
        "price": "28.00",
        "regular_price": "32.00",
        "sale_price": "28.00",
        "manage_stock": True,
        "stock_quantity": 60,
        "stock_status": "instock",
        "categories": [
            {"id": 30, "name": "Groceries", "slug": "groceries"}
        ],
        "images": [
            {
                "id": 1023,
                "src": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600",
                "name": "Coffee Beans",
                "alt": "Bag of roasted coffee beans",
            }
        ],
        "attributes": [],
    },
]


def mock_httpx_get_woocommerce(url, *args, **kwargs):
    """Dispatcher for mocked WooCommerce REST API GET endpoints."""
    mock_resp = MagicMock()
    url_str = str(url)

    # Check for authentication credentials
    auth = kwargs.get("auth")
    if auth:
        username = getattr(auth, "username", None) or (auth[0] if isinstance(auth, tuple) else "")
        password = getattr(auth, "password", None) or (auth[1] if isinstance(auth, tuple) else "")
        if username == "bad_key" or password == "bad_secret":
            mock_resp.status_code = 401
            mock_resp.text = '{"code": "woocommerce_rest_cannot_view", "message": "Consumer key is invalid.", "data": {"status": 401}}'
            mock_resp.json.return_value = {"code": "woocommerce_rest_cannot_view", "message": "Consumer key is invalid.", "data": {"status": 401}}
            return mock_resp

    if "system_status" in url_str:
        mock_resp.status_code = 200
        mock_resp.text = '{"environment": {"version": "8.5.0", "wp_version": "6.4.3"}}'
        mock_resp.json.return_value = {"environment": {"version": "8.5.0", "wp_version": "6.4.3"}}
        return mock_resp

    if "products" in url_str:
        mock_resp.status_code = 200
        mock_resp.text = str(MOCK_WOOCOMMERCE_PRODUCTS_PAYLOAD)
        mock_resp.json.return_value = MOCK_WOOCOMMERCE_PRODUCTS_PAYLOAD
        return mock_resp

    mock_resp.status_code = 404
    mock_resp.text = '{"code": "not_found"}'
    mock_resp.json.return_value = {"code": "not_found"}
    return mock_resp


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


@pytest.fixture
def test_merchant():
    """Create a verified test merchant user and an isolated store tenant."""
    email = f"woo_merchant_{uuid.uuid4().hex[:8]}@example.com"
    token = create_and_verify_user(email=email, full_name="WooCommerce Merchant")
    headers = {"Authorization": f"Bearer {token}"}

    phone_id = f"wa_woo_{uuid.uuid4().hex[:8]}"
    store_res = client.post(
        "/api/v1/stores",
        headers=headers,
        json={
            "name": f"Woo Store {uuid.uuid4().hex[:4]}",
            "owner_email": email,
            "whatsapp_phone_number_id": phone_id,
            "whatsapp_access_token": "token_woo_test_secret",
            "system_prompt": "You are a professional assistant for this WooCommerce store.",
        },
    )
    assert store_res.status_code == 201
    store_data = store_res.json()

    return {
        "email": email,
        "token": token,
        "headers": headers,
        "store_id": store_data["id"],
        "phone_id": phone_id,
        "store_name": store_data["name"],
    }


class TestWooCommerceIntegration:
    """Test suite covering WooCommerce connect, invalid credentials, catalog ingestion, and AI stock queries."""

    @patch("httpx.Client.get", side_effect=mock_httpx_get_woocommerce)
    def test_woocommerce_connect_endpoint(self, mock_get, test_merchant):
        """
        Test Case 1: Connect WooCommerce Store
        - Authenticate test user/merchant store.
        - Call POST /api/v1/integrations/woocommerce/connect with store_url, consumer_key, consumer_secret.
        - Verify 200 OK response with synced product count.
        - Verify store_integrations table has platform='woocommerce', saved keys, and sync_status='connected'.
        - Verify products are persisted in the PostgreSQL products table scoped to store_id.
        """
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]
        store_uuid = uuid.UUID(store_id)

        # 1. Call Connect Endpoint
        connect_payload = {
            "store_id": store_id,
            "store_url": MOCK_STORE_URL,
            "consumer_key": MOCK_CK,
            "consumer_secret": MOCK_CS,
        }

        res = client.post(
            "/api/v1/integrations/woocommerce/connect",
            headers=headers,
            json=connect_payload,
        )

        assert res.status_code == 200, f"WooCommerce connect failed: {res.text}"
        data = res.json()

        # 2. Verify API response payload
        assert data["platform"] == "woocommerce"
        assert data["store_id"] == store_id
        assert data["shop_domain"] == MOCK_STORE_URL
        assert data["sync_status"] == "connected"
        assert data["products_synced_count"] >= 3

        # 3. Verify Database StoreIntegration record
        db = SessionLocal()
        try:
            integration = (
                db.query(StoreIntegration)
                .filter(
                    StoreIntegration.store_id == store_uuid,
                    StoreIntegration.platform == "woocommerce",
                )
                .first()
            )
            assert integration is not None, "StoreIntegration record was not created."
            assert integration.platform == "woocommerce"
            assert integration.shop_domain == MOCK_STORE_URL
            assert integration.api_key == MOCK_CK
            assert integration.access_token == MOCK_CS
            assert integration.sync_status == "connected"
            assert integration.products_synced_count >= 3
            assert integration.last_synced_at is not None

            # 4. Verify Products table persistence and tenant scoping
            products = (
                db.query(Product)
                .filter(Product.store_id == store_uuid)
                .order_by(Product.id.asc())
                .all()
            )
            assert len(products) >= 3, f"Expected at least 3 products, found {len(products)}"

            titles = [p.title for p in products]
            assert "Woo Premium Leather Jacket" in titles
            assert "Ergonomic Wireless Mechanical Keyboard" in titles
            assert "Artisan Roast Organic Coffee Beans 1kg" in titles

            jacket = next(p for p in products if p.title == "Woo Premium Leather Jacket")
            assert jacket.price == 199.99
            assert jacket.stock_quantity == 42
            assert jacket.category == "Apparel"
            assert "Handcrafted genuine leather jacket" in jacket.description
            assert "<p>" not in jacket.description  # HTML stripped
            assert len(jacket.size_variants) == 4  # S, M, L, XL
            assert jacket.image_url == "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600"

            keyboard = next(p for p in products if p.title == "Ergonomic Wireless Mechanical Keyboard")
            assert keyboard.price == 129.50
            assert keyboard.stock_quantity == 25
            assert keyboard.category == "Electronics"

            coffee = next(p for p in products if p.title == "Artisan Roast Organic Coffee Beans 1kg")
            assert coffee.price == 28.00
            assert coffee.stock_quantity == 60
            assert coffee.category == "Groceries"

        finally:
            db.close()

    @patch("httpx.Client.get")
    def test_woocommerce_invalid_credentials(self, mock_get, test_merchant):
        """
        Test Case 2: Invalid Credentials Handling
        - Mock 401 Unauthorized from WooCommerce API.
        - Ensure endpoint returns 400/401 error message.
        - Confirm invalid credentials are NOT saved to store_integrations.
        """
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]
        store_uuid = uuid.UUID(store_id)

        # Mock 401 Unauthorized from system_status and products endpoints
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = '{"code": "woocommerce_rest_cannot_view", "message": "Consumer key is invalid."}'
        mock_get.return_value = mock_resp

        connect_payload = {
            "store_id": store_id,
            "store_url": "https://invalid-credentials-store.com",
            "consumer_key": "bad_key",
            "consumer_secret": "bad_secret",
        }

        res = client.post(
            "/api/v1/integrations/woocommerce/connect",
            headers=headers,
            json=connect_payload,
        )

        assert res.status_code in (400, 401), f"Expected 400/401, got {res.status_code}: {res.text}"
        error_detail = res.json().get("detail", "")
        assert "Invalid WooCommerce" in error_detail or "Failed to authenticate" in error_detail

        # Verify no integration record was created with invalid credentials
        db = SessionLocal()
        try:
            integration = (
                db.query(StoreIntegration)
                .filter(
                    StoreIntegration.store_id == store_uuid,
                    StoreIntegration.platform == "woocommerce",
                )
                .first()
            )
            assert integration is None, "StoreIntegration should not be created for invalid credentials."
        finally:
            db.close()

    @patch("httpx.Client.get", side_effect=mock_httpx_get_woocommerce)
    def test_ai_agent_queries_woocommerce_products(self, mock_get, test_merchant):
        """
        Test Case 3: AI Agent & db_tools Stock Queries on Ingested WooCommerce Products
        - Connect and ingest WooCommerce products.
        - Verify check_product_stock queries newly ingested items with correct stock and pricing.
        - Verify strict multi-tenant scoping (other store tenants cannot see these products).
        - Verify execute_db_tool dispatcher handles the ingested products correctly.
        - Verify AI Support Service generates grounded reply referencing the WooCommerce item.
        """
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]
        store_uuid = uuid.UUID(store_id)

        # 1. Connect WooCommerce store
        connect_res = client.post(
            "/api/v1/integrations/woocommerce/connect",
            headers=headers,
            json={
                "store_id": store_id,
                "store_url": MOCK_STORE_URL,
                "consumer_key": MOCK_CK,
                "consumer_secret": MOCK_CS,
            },
        )
        assert connect_res.status_code == 200

        db = SessionLocal()
        try:
            # 2. Query check_product_stock directly for "Leather Jacket"
            jacket_res = check_product_stock("Leather Jacket", store_id=store_uuid, db=db)
            assert "error" not in jacket_res, f"Unexpected error: {jacket_res}"
            assert jacket_res["name"] == "Woo Premium Leather Jacket"
            assert jacket_res["stock_quantity"] == 42
            assert jacket_res["price"] == 199.99
            assert jacket_res["in_stock"] is True

            # 3. Query check_product_stock for "Keyboard"
            kbd_res = check_product_stock("Keyboard", store_id=store_uuid, db=db)
            assert "error" not in kbd_res, f"Unexpected error: {kbd_res}"
            assert kbd_res["name"] == "Ergonomic Wireless Mechanical Keyboard"
            assert kbd_res["stock_quantity"] == 25
            assert kbd_res["price"] == 129.50
            assert kbd_res["in_stock"] is True

            # 4. Query check_product_stock for "Coffee"
            coffee_res = check_product_stock("Coffee Beans", store_id=store_uuid, db=db)
            assert "error" not in coffee_res, f"Unexpected error: {coffee_res}"
            assert coffee_res["name"] == "Artisan Roast Organic Coffee Beans 1kg"
            assert coffee_res["stock_quantity"] == 60
            assert coffee_res["price"] == 28.00

            # 5. Verify Multi-Tenant Isolation: Another store tenant should NOT find these products
            foreign_store_uuid = uuid.uuid4()
            leak_res = check_product_stock("Leather Jacket", store_id=foreign_store_uuid, db=db)
            assert leak_res.get("error") == "Product not found"

            # 6. Verify execute_db_tool dispatcher
            tool_res = execute_db_tool("check_product_stock", {"product_name": "Leather Jacket"}, store_id=store_uuid, db=db)
            assert tool_res.get("in_stock") is True
            assert tool_res.get("name") == "Woo Premium Leather Jacket"
            assert tool_res.get("stock_quantity") == 42
            assert tool_res.get("price") == 199.99

            # 7. Verify AI Support Service with Gemini function calling loop on WooCommerce products
            ai_service = AISupportService()

            # Mock Gemini multi-turn: Turn 1 model calls check_product_stock -> Turn 2 model answers
            resp_turn1 = MagicMock()
            resp_turn1.status_code = 200
            resp_turn1.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [
                                {
                                    "functionCall": {
                                        "name": "check_product_stock",
                                        "args": {"product_name": "Leather Jacket"},
                                    }
                                }
                            ],
                        }
                    }
                ]
            }

            resp_turn2 = MagicMock()
            resp_turn2.status_code = 200
            resp_turn2.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "role": "model",
                            "parts": [
                                {
                                    "text": "Yes! The Woo Premium Leather Jacket is currently in stock (42 available) for $199.99 ✨."
                                }
                            ],
                        }
                    }
                ]
            }

            with patch("requests.post", side_effect=[resp_turn1, resp_turn2]):
                ai_reply = ai_service._call_gemini_api(
                    prompt="Do you have any leather jackets in stock?",
                    api_key="AIzaSyDummyKeyForTesting",
                    model="gemini-2.5-flash",
                    store_id=store_uuid,
                    db=db,
                )

                assert ai_reply is not None
                assert "Woo Premium Leather Jacket" in ai_reply or "Leather Jacket" in ai_reply
                assert "199.99" in ai_reply or "in stock" in ai_reply.lower()

        finally:
            db.close()


    @patch("httpx.Client.get", side_effect=mock_httpx_get_woocommerce)
    def test_woocommerce_manual_sync_endpoint(self, mock_get, test_merchant):
        """
        Test manual sync endpoint POST /api/v1/integrations/woocommerce/sync.
        """
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]

        # First connect
        client.post(
            "/api/v1/integrations/woocommerce/connect",
            headers=headers,
            json={
                "store_id": store_id,
                "store_url": MOCK_STORE_URL,
                "consumer_key": MOCK_CK,
                "consumer_secret": MOCK_CS,
            },
        )

        # Trigger manual sync
        sync_res = client.post(
            "/api/v1/integrations/woocommerce/sync",
            headers=headers,
            json={"store_id": store_id},
        )

        assert sync_res.status_code == 200
        sync_data = sync_res.json()
        assert sync_data["success"] is True
        assert sync_data["platform"] == "woocommerce"
        assert sync_data["products_synced"] >= 3
