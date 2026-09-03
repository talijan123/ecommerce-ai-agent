"""
Integration and Unit Test Suite for FastAPI E-Commerce AI Agent Service.
Tests database services, tool schemas, REST API endpoints, and webhook ingestion.
"""

import sys

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.product import Product
from app.services.order_service import OrderService
from app.services.inventory_service import InventoryService
from app.services.cart_service import CartService
from app.tools.schemas import execute_tool_with_db, OPENAI_TOOLS
from scripts.seed_real_products import seed_real_products

client = TestClient(app)


def test_system_endpoints():
    print("🔹 Testing System Endpoints (Root & Health)...")
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] in ("operational", "ok")

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    print("  ✓ Root and Health check endpoints operational")


def test_database_order_service():
    print("\n🔹 Testing Database OrderService...")
    db = SessionLocal()
    try:
        service = OrderService(db)

        # 1. Valid order lookup
        res_1042 = service.get_order_by_id_or_number("1042")
        assert res_1042["success"] is True
        assert res_1042["status"] == "Shipped"
        assert res_1042["tracking_number"] == "TRK-FEDEX-984210"
        print("  ✓ Order #1042 (Shipped) DB lookup verified")

        # 2. Order lookup with '#' prefix
        res_1043 = service.get_order_by_id_or_number("#1043")
        assert res_1043["success"] is True
        assert res_1043["status"] == "Processing"
        assert "Tomorrow" in res_1043["estimated_delivery"]
        print("  ✓ Order #1043 (Processing with #) DB lookup verified")

        # 3. Non-existent order
        res_invalid = service.get_order_by_id_or_number("99999")
        assert res_invalid["success"] is False
        assert "not found" in res_invalid["error"].lower()
        print("  ✓ Non-existent order handled cleanly")
    finally:
        db.close()


def test_database_inventory_service():
    print("\n🔹 Testing Database InventoryService...")
    db = SessionLocal()
    try:
        service = InventoryService(db)
        first_product = db.query(Product).first()
        assert first_product is not None, "Product database should not be empty"

        # 1. Check inventory of first product
        res = service.check_inventory(first_product.title)
        assert len(res) > 0
        assert res[0]["product_id"] == first_product.id
        assert res[0]["in_stock"] is True
        print(f"  ✓ Product inventory lookup for '{first_product.title}' verified")

        # 2. Fuzzy search
        search_keyword = first_product.category
        res_cat = service.check_inventory(search_keyword)
        assert len(res_cat) > 0
        print(f"  ✓ Fuzzy category inventory search for '{search_keyword}' verified")
    finally:
        db.close()


def test_database_cart_service():
    print("\n🔹 Testing Database CartService...")
    db = SessionLocal()
    try:
        service = CartService(db)

        # 1. Eligible customer
        res_eligible = service.apply_cart_recovery_discount("sarah.smith@example.com")
        assert res_eligible["success"] is True
        assert res_eligible["discount_code"] == "SAVE15"
        assert res_eligible["discount_percentage"] == 15
        print("  ✓ Eligible cart recovery discount verified")

        # 2. Unknown customer
        res_unknown = service.apply_cart_recovery_discount("unknown@example.com")
        assert res_unknown["success"] is False
        assert "no active or abandoned cart" in res_unknown["error"].lower()
        print("  ✓ Unknown customer cart lookup handled cleanly")
    finally:
        db.close()


def test_tool_dispatcher_with_db():
    print("\n🔹 Testing Tool Dispatcher with Database Session...")
    db = SessionLocal()
    try:
        assert len(OPENAI_TOOLS) == 3
        # Dispatch order status tool
        order_out = execute_tool_with_db(db, "get_order_status", {"order_id": "1042"})
        assert order_out["success"] is True
        assert order_out["order_number"] == "1042"

        # Dispatch inventory tool
        first_product = db.query(Product).first()
        inv_out = execute_tool_with_db(db, "check_product_inventory", {"product_name": first_product.title})
        assert len(inv_out) > 0
        assert inv_out[0]["in_stock"] is True
        print("  ✓ DB-injected tool dispatcher verified")
    finally:
        db.close()


def test_chat_and_history_endpoints():
    print("\n🔹 Testing Chat & History REST API Endpoints...")
    test_session = "test_session_api_001"

    # Send chat query
    payload = {
        "session_id": test_session,
        "message": "Where is my order #1042?",
        "customer_email": "hamza.tariq@example.com",
    }
    res = client.post("/api/v1/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == test_session
    assert "response" in data
    print("  ✓ POST /api/v1/chat endpoint returned response")

    # Retrieve history
    res_hist = client.get(f"/api/v1/chat/history/{test_session}")
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) >= 2  # At least user and assistant messages
    assert history[0]["role"] == "user"
    print(f"  ✓ GET /api/v1/chat/history/{test_session} returned {len(history)} recorded turns")


def test_webhooks_endpoints():
    print("\n🔹 Testing Webhooks Ingestion Endpoints...")
    db = SessionLocal()
    first_product = db.query(Product).first()
    db.close()

    # 1. Order create webhook
    order_payload = {
        "order_number": "WH-9001",
        "email": "customer.webhook@example.com",
        "customer_name": "Webhook Buyer",
        "fulfillment_status": "fulfilled",
        "carrier": "FedEx",
        "tracking_number": "TRK-WH-999",
        "tracking_url": "https://tracking.fedex.com/TRK-WH-999",
        "total_price": 99.99,
        "line_items": [
            {"title": first_product.title, "size": first_product.size_variants[0]["size"] if first_product.size_variants else "Standard", "quantity": 1, "price": first_product.price}
        ]
    }
    res_wh_order = client.post("/api/v1/webhooks/orders/create", json=order_payload)
    assert res_wh_order.status_code == 200
    assert res_wh_order.json()["success"] is True
    print("  ✓ POST /api/v1/webhooks/orders/create successfully ingested order WH-9001")

    # 2. Verify order is now queryable via OrderService
    db = SessionLocal()
    try:
        service = OrderService(db)
        wh_order = service.get_order_by_id_or_number("WH-9001")
        assert wh_order["success"] is True
        assert wh_order["customer_name"] == "Webhook Buyer"
        print("  ✓ Ingested webhook order is instantly queryable in database")
    finally:
        db.close()

    # 3. Inventory update webhook
    inv_payload = {
        "sku": first_product.sku,
        "available": 50,
        "size": first_product.size_variants[0]["size"] if first_product.size_variants else "Standard"
    }
    res_wh_inv = client.post("/api/v1/webhooks/inventory/update", json=inv_payload)
    assert res_wh_inv.status_code == 200
    assert res_wh_inv.json()["success"] is True
    print(f"  ✓ POST /api/v1/webhooks/inventory/update restocked SKU {first_product.sku}")

    # 4. Verify restocked size is now in stock
    db = SessionLocal()
    try:
        service = InventoryService(db)
        inv_check = service.check_inventory(first_product.title)
        assert inv_check[0]["in_stock"] is True
        print("  ✓ Live inventory check confirms restocked item is now IN STOCK")
    finally:
        db.close()


def test_admin_endpoints():
    print("\n🔹 Testing Merchant Admin Endpoints...")
    res_stats = client.get("/api/v1/admin/stats")
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert "total_conversations" in stats
    assert "low_stock_alerts" in stats
    print(f"  ✓ GET /api/v1/admin/stats verified (Total Conversations: {stats['total_conversations']}, Alerts: {stats['low_stock_alerts']})")

    res_convs = client.get("/api/v1/admin/conversations")
    assert res_convs.status_code == 200
    convs = res_convs.json()
    assert isinstance(convs, list)
    print(f"  ✓ GET /api/v1/admin/conversations verified ({len(convs)} sessions found)")

    res_prods = client.get("/api/v1/admin/products")
    assert res_prods.status_code == 200
    prods = res_prods.json()
    assert len(prods) == 100, f"Expected 100 products, got {len(prods)}"
    print(f"  ✓ GET /api/v1/admin/products verified (All {len(prods)} products retrieved with full schema)")

    res_orders = client.get("/api/v1/admin/orders")
    assert res_orders.status_code == 200
    orders = res_orders.json()
    assert len(orders) >= 3
    print(f"  ✓ GET /api/v1/admin/orders verified ({len(orders)} orders retrieved)")


if __name__ == "__main__":
    print("=" * 75)
    print(" 🚀 RUNNING FASTAPI & DATABASE INTEGRATION TEST SUITE")
    print("=" * 75)
    test_system_endpoints()
    test_database_order_service()
    test_database_inventory_service()
    test_database_cart_service()
    test_tool_dispatcher_with_db()
    test_chat_and_history_endpoints()
    test_webhooks_endpoints()
    test_admin_endpoints()
    print("\n" + "=" * 75)
    print(" 🎉 ALL FASTAPI, DATABASE, ADMIN & WEBHOOK TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)
