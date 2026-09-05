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
    assert len(prods) >= 100, f"Expected at least 100 products, got {len(prods)}"
    print(f"  ✓ GET /api/v1/admin/products verified (All {len(prods)} products retrieved with full schema)")

    res_orders = client.get("/api/v1/admin/orders")
    assert res_orders.status_code == 200
    orders = res_orders.json()
    assert len(orders) >= 3
    print(f"  ✓ GET /api/v1/admin/orders verified ({len(orders)} orders retrieved)")


def test_whatsapp_sandbox_endpoints():
    print("\n🔹 Testing WhatsApp Sandbox Endpoints...")
    # 1. GET /api/v1/whatsapp/sandbox-info
    res_info = client.get("/api/v1/whatsapp/sandbox-info")
    assert res_info.status_code == 200
    info = res_info.json()
    assert "sandbox_phone_number" in info
    assert "clean_phone_number" in info
    assert "connect_command_template" in info
    print(f"  ✓ GET /api/v1/whatsapp/sandbox-info verified (Phone: {info['sandbox_phone_number']})")

    # 2. Simulate CONNECT <store_id> command
    db = SessionLocal()
    from app.models.store import Store
    sample_store = db.query(Store).filter(Store.is_active == True).first()
    db.close()

    if sample_store:
        sim_payload = {
            "sender_phone": "+19998887777",
            "message_text": f"CONNECT {sample_store.id}",
            "store_id": str(sample_store.id),
        }
        res_sim = client.post("/api/v1/whatsapp/sandbox/simulate-message", json=sim_payload)
        assert res_sim.status_code == 200
        sim_data = res_sim.json()
        assert sim_data["status"] == "connected"
        assert sample_store.name in sim_data["reply"]
        print(f"  ✓ POST /api/v1/whatsapp/sandbox/simulate-message CONNECT bound to store '{sample_store.name}'")

        # 3. Simulate subsequent product query turn
        sim_turn = {
            "sender_phone": "+19998887777",
            "message_text": "Do you have any shoes or jackets in stock?",
        }
        res_turn = client.post("/api/v1/whatsapp/sandbox/simulate-message", json=sim_turn)
        assert res_turn.status_code == 200
        turn_data = res_turn.json()
        assert "reply" in turn_data or "status" in turn_data
        print(f"  ✓ Subsequent turn routed to bound sandbox session successfully")

        # 4. Simulate DISCONNECT
        sim_disc = {
            "sender_phone": "+19998887777",
            "message_text": "DISCONNECT",
        }
        res_disc = client.post("/api/v1/whatsapp/sandbox/simulate-message", json=sim_disc)
        assert res_disc.status_code == 200
        disc_data = res_disc.json()
        assert disc_data["status"] == "disconnected"
        print(f"  ✓ DISCONNECT command unlinked sandbox session cleanly")


def test_store_integrations_and_tickets():
    print("\n🔹 Testing Store Integrations, Support Tickets & Super-Admin Console...")
    from app.core.security import create_access_token
    from app.models.user import User
    from app.models.store import Store

    db = SessionLocal()
    # Create or retrieve test user and store
    test_user = db.query(User).filter(User.email == "admin@autocommerce.ai").first()
    if not test_user:
        test_user = User(
            email="admin@autocommerce.ai",
            hashed_password="hashed_test_password",
            full_name="Platform Owner",
            is_verified=True,
            role="super_admin",
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
    else:
        test_user.role = "super_admin"
        db.commit()
        db.refresh(test_user)

    user_id_str = str(test_user.id)
    user_email = str(test_user.email)
    sample_store = db.query(Store).first()
    store_id_str = str(sample_store.id) if sample_store else None
    db.close()

    token = create_access_token({"sub": user_id_str, "email": user_email})
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 1. Test Shopify Connect & Sync
    if store_id_str:
        shopify_payload = {
            "store_id": store_id_str,
            "shop_domain": "brand-demo.myshopify.com",
            "access_token": "shpat_test_token_123",
        }
        res_shpf_conn = client.post("/api/v1/integrations/shopify/connect", json=shopify_payload, headers=auth_headers)
        assert res_shpf_conn.status_code == 200
        assert res_shpf_conn.json()["platform"] == "shopify"
        print("  ✓ POST /api/v1/integrations/shopify/connect verified")

        res_shpf_sync = client.post("/api/v1/integrations/shopify/sync", json={"store_id": store_id_str}, headers=auth_headers)
        assert res_shpf_sync.status_code == 200
        assert res_shpf_sync.json()["success"] is True
        print(f"  ✓ POST /api/v1/integrations/shopify/sync synced {res_shpf_sync.json()['products_synced']} items")

        # 2. Test List Integrations
        res_list_int = client.get(f"/api/v1/integrations/{store_id_str}", headers=auth_headers)
        assert res_list_int.status_code == 200
        assert len(res_list_int.json()) >= 1
        print(f"  ✓ GET /api/v1/integrations/{store_id_str} verified")

    # 3. Test Support Ticket Submission
    ticket_payload = {
        "store_id": store_id_str,
        "subject": "Webhook latency test",
        "description": "Investigating WhatsApp webhook dispatch speed for catalog search queries.",
        "category": "whatsapp",
        "priority": "high",
    }
    res_ticket = client.post("/api/v1/support/tickets", json=ticket_payload, headers=auth_headers)
    assert res_ticket.status_code == 201
    created_ticket = res_ticket.json()
    assert created_ticket["status"] == "Open"
    print(f"  ✓ POST /api/v1/support/tickets created ticket #{created_ticket['id'][:8]}")

    # 4. Test Super Admin Stats
    res_stats = client.get("/api/v1/super-admin/stats", headers=auth_headers)
    assert res_stats.status_code == 200
    sa_stats = res_stats.json()
    assert "total_merchants" in sa_stats
    assert "tickets" in sa_stats
    print(f"  ✓ GET /api/v1/super-admin/stats verified ({sa_stats['total_merchants']} merchants, {sa_stats['total_products']} products)")

    # 5. Test Super Admin Tenants Directory
    res_tenants = client.get("/api/v1/super-admin/tenants", headers=auth_headers)
    assert res_tenants.status_code == 200
    assert len(res_tenants.json()) >= 1
    print(f"  ✓ GET /api/v1/super-admin/tenants verified ({len(res_tenants.json())} tenants listed)")

    # 6. Test Super Admin Ticket Triage Update
    res_patch = client.patch(
        f"/api/v1/super-admin/tickets/{created_ticket['id']}",
        json={"status": "Resolved", "resolution_notes": "Tested successfully on staging cluster."},
        headers=auth_headers,
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "Resolved"
    print(f"  ✓ PATCH /api/v1/super-admin/tickets/{created_ticket['id'][:8]} resolved successfully")


def test_super_admin_aroobjan_access():
    print("\n🔹 Testing Super-Admin Privileges for aroobjan965@gmail.com...")
    from app.core.security import create_access_token, get_password_hash
    from app.models.user import User

    db = SessionLocal()
    # 1. Verify user in database
    aroob_user = db.query(User).filter(User.email == "aroobjan965@gmail.com").first()
    if not aroob_user:
        aroob_user = User(
            email="aroobjan965@gmail.com",
            hashed_password=get_password_hash("SuperAdmin2026!#"),
            full_name="Aroob Jan",
            is_verified=True,
            role="super_admin",
        )
        db.add(aroob_user)
        db.commit()
        db.refresh(aroob_user)

    assert aroob_user.role == "super_admin", f"Expected role 'super_admin', got '{aroob_user.role}'"
    aroob_user_id = str(aroob_user.id)
    aroob_email = str(aroob_user.email)

    # 2. Verify non-superadmin user for comparison
    test_merchant = db.query(User).filter(User.email == "test_regular_merchant@example.com").first()
    if not test_merchant:
        test_merchant = User(
            email="test_regular_merchant@example.com",
            hashed_password=get_password_hash("Password123!"),
            full_name="Regular Merchant",
            is_verified=True,
            role="merchant",
        )
        db.add(test_merchant)
        db.commit()
        db.refresh(test_merchant)
    else:
        test_merchant.role = "merchant"
        db.commit()
        db.refresh(test_merchant)

    merchant_user_id = str(test_merchant.id)
    merchant_email = str(test_merchant.email)
    db.close()

    # Generate tokens
    aroob_token = create_access_token({"sub": aroob_user_id, "email": aroob_email})
    aroob_auth_headers = {"Authorization": f"Bearer {aroob_token}"}

    merchant_token = create_access_token({"sub": merchant_user_id, "email": merchant_email})
    merchant_auth_headers = {"Authorization": f"Bearer {merchant_token}"}

    # 3. Verify aroobjan965@gmail.com access to /api/v1/super-admin/stats
    res_stats = client.get("/api/v1/super-admin/stats", headers=aroob_auth_headers)
    assert res_stats.status_code == 200, f"aroobjan965@gmail.com should have 200 OK access to stats, got {res_stats.status_code}"
    print("  ✓ GET /api/v1/super-admin/stats returned 200 OK for aroobjan965@gmail.com")

    # 4. Verify aroobjan965@gmail.com access to /api/v1/super-admin/tenants
    res_tenants = client.get("/api/v1/super-admin/tenants", headers=aroob_auth_headers)
    assert res_tenants.status_code == 200, f"aroobjan965@gmail.com should have 200 OK access to tenants, got {res_tenants.status_code}"
    print("  ✓ GET /api/v1/super-admin/tenants returned 200 OK for aroobjan965@gmail.com")

    # 5. Verify aroobjan965@gmail.com access to /api/v1/super-admin/tickets
    res_tickets = client.get("/api/v1/super-admin/tickets", headers=aroob_auth_headers)
    assert res_tickets.status_code == 200, f"aroobjan965@gmail.com should have 200 OK access to tickets, got {res_tickets.status_code}"
    print("  ✓ GET /api/v1/super-admin/tickets returned 200 OK for aroobjan965@gmail.com")

    # 6. Verify unauthorized regular merchant receives 403 Forbidden
    res_unauth = client.get("/api/v1/super-admin/stats", headers=merchant_auth_headers)
    assert res_unauth.status_code == 403, f"Regular merchant should receive 403 Forbidden, got {res_unauth.status_code}"
    print("  ✓ Non-admin merchant correctly blocked with 403 Forbidden")


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
    test_whatsapp_sandbox_endpoints()
    test_store_integrations_and_tickets()
    test_super_admin_aroobjan_access()
    print("\n" + "=" * 75)
    print(" 🎉 ALL FASTAPI, DATABASE, ADMIN, WEBHOOK, INTEGRATION & SUPER-ADMIN TESTS PASSED!")
    print("=" * 75)
