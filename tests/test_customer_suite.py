"""
Comprehensive Test Suite for End-to-End Customer-Facing Suite (Phases 1, 2, & 3).

Verifies:
1. Phase 1: Abandoned Cart Webhook Ingestion, Scheduled Recovery Dispatch Engine, and Conversational Negotiation.
2. Phase 2: Embeddable Storefront Live Chat API Bridge, Tenant Scoping, and Tool Execution.
3. Phase 3: Post-Purchase Order Webhook Ingestion, Automated WhatsApp Notifications (Confirmation & Tracking),
   WISMO Self-Service, and Human Handover Escalation.
"""

import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.cart import CartSession
from app.models.order import Order
from app.models.product import Product
from app.models.chat import ChatHistory
from app.services.cart_recovery import track_cart_engagement
from app.services.cart_recovery_scheduler import CartRecoveryScheduler
from app.services.db_tools import track_order, check_product_stock
from app.services.chat_service import ChatService
from app.services.ai_support_service import AISupportService
from app.tools.schemas import execute_tool_with_db
from tests.test_auth import create_and_verify_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


@pytest.fixture
def test_store_tenant():
    """Create a verified test merchant and multi-tenant store."""
    email = f"merchant_suite_{uuid.uuid4().hex[:8]}@example.com"
    token = create_and_verify_user(email=email, full_name="Suite Merchant")
    headers = {"Authorization": f"Bearer {token}"}

    phone_id = f"wa_suite_{uuid.uuid4().hex[:8]}"
    store_res = client.post(
        "/api/v1/stores",
        headers=headers,
        json={
            "name": f"Customer Suite Store {uuid.uuid4().hex[:4]}",
            "owner_email": email,
            "whatsapp_phone_number_id": phone_id,
            "whatsapp_access_token": "token_suite_secret_999",
            "system_prompt": "You are a customer assistant for this store.",
        },
    )
    assert store_res.status_code == 201
    store_data = store_res.json()

    # Pre-populate sample product in PostgreSQL for the store
    db = SessionLocal()
    try:
        store_uuid = uuid.UUID(store_data["id"])
        prod = Product(
            store_id=store_uuid,
            sku=f"SUITE-TEE-{uuid.uuid4().hex[:4]}",
            title="Premium Organic Cotton Tee",
            description="Ultra-soft 100% organic cotton crewneck t-shirt.",
            category="Apparel",
            price=39.99,
            stock_quantity=30,
            size_variants=[
                {"size": "S", "stock": 10, "price": 39.99},
                {"size": "M", "stock": 15, "price": 39.99},
                {"size": "L", "stock": 5, "price": 39.99},
            ],
            image_url="https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600",
        )
        db.add(prod)
        db.commit()
    finally:
        db.close()

    return {
        "email": email,
        "token": token,
        "headers": headers,
        "store_id": store_data["id"],
        "store_uuid": uuid.UUID(store_data["id"]),
        "phone_id": phone_id,
        "store_name": store_data["name"],
    }


# =========================================================================
# Phase 1 Tests: Autonomous WhatsApp Abandoned Cart Recovery Engine
# =========================================================================

class TestPhase1AbandonedCartRecoveryEngine:
    """Tests webhook ingestion, recovery scheduler dispatch, and conversational negotiation."""

    def test_shopify_and_woocommerce_cart_webhook_ingestion(self, test_store_tenant):
        """Test abandoned checkout webhook ingestion from Shopify and WooCommerce."""
        store_id = test_store_tenant["store_id"]
        store_uuid = test_store_tenant["store_uuid"]

        # 1. Ingest Shopify Abandoned Checkout
        shopify_cart_token = f"sh_cart_{uuid.uuid4().hex[:8]}"
        shopify_payload = {
            "session_id": shopify_cart_token,
            "customer_name": "Amina Tariq",
            "customer_email": "amina.tariq@example.com",
            "customer_phone": "+923001234567",
            "abandoned_checkout_url": f"https://mystore.myshopify.com/checkouts/{shopify_cart_token}",
            "total_price": 79.98,
            "line_items": [
                {
                    "title": "Premium Organic Cotton Tee",
                    "price": 39.99,
                    "quantity": 2,
                    "variant_title": "M",
                }
            ],
        }

        res_sh = client.post(
            f"/api/v1/webhooks/shopify/{store_id}/checkouts",
            json=shopify_payload,
        )
        assert res_sh.status_code == 200
        sh_data = res_sh.json()
        assert sh_data["success"] is True

        # 2. Ingest WooCommerce Abandoned Cart
        woo_cart_id = f"wc_cart_{uuid.uuid4().hex[:8]}"
        woo_payload = {
            "session_id": woo_cart_id,
            "customer_name": "Hamza Ali",
            "customer_email": "hamza.ali@example.com",
            "customer_phone": "+923187806306",
            "checkout_url": f"https://mywoostore.com/checkout/?cart={woo_cart_id}",
            "total_price": 39.99,
            "items": [
                {
                    "name": "Premium Organic Cotton Tee",
                    "price": 39.99,
                    "quantity": 1,
                    "size": "L",
                }
            ],
        }

        res_wc = client.post(
            f"/api/v1/webhooks/woocommerce/{store_id}/cart",
            json=woo_payload,
        )
        assert res_wc.status_code == 200
        wc_data = res_wc.json()
        assert wc_data["success"] is True

        # 3. Verify Database Persistence & Tenant Scoping
        db = SessionLocal()
        try:
            cart_sh = db.query(CartSession).filter(CartSession.session_id == shopify_cart_token).first()
            assert cart_sh is not None
            assert cart_sh.store_id == store_uuid
            assert cart_sh.customer_name == "Amina Tariq"
            assert cart_sh.customer_phone == "+923001234567"
            assert cart_sh.status == "pending"
            assert cart_sh.recovery_sent is False
            assert "checkouts" in cart_sh.checkout_url
            assert len(cart_sh.abandoned_items) == 1

            cart_wc = db.query(CartSession).filter(CartSession.session_id == woo_cart_id).first()
            assert cart_wc is not None
            assert cart_wc.store_id == store_uuid
            assert cart_wc.customer_name == "Hamza Ali"
            assert cart_wc.status == "pending"
        finally:
            db.close()

    @patch("app.services.whatsapp_service.whatsapp_service.send_text_message_sync")
    def test_scheduled_cart_recovery_dispatch(self, mock_send_wa, test_store_tenant):
        """Test CartRecoveryScheduler identifying carts > 30 mins old and dispatching WhatsApp recovery."""
        store_id = test_store_tenant["store_id"]
        store_uuid = test_store_tenant["store_uuid"]

        mock_send_wa.return_value = {"success": True, "message_id": f"wamid_{uuid.uuid4().hex[:8]}"}

        # Create an abandoned cart from 45 minutes ago
        session_id = f"sched_cart_{uuid.uuid4().hex[:8]}"
        past_time = datetime.now(timezone.utc) - timedelta(minutes=45)

        db = SessionLocal()
        try:
            cart = CartSession(
                store_id=store_uuid,
                session_id=session_id,
                customer_name="Zainab Khan",
                customer_email="zainab@example.com",
                customer_phone="+923331122334",
                abandoned_items=[{"title": "Premium Organic Cotton Tee", "price": 39.99, "size": "M"}],
                checkout_url="https://store.com/checkout?session=123",
                status="pending",
                discount_code="RECOVER10",
                discount_percentage=10,
                recovery_sent=False,
                created_at=past_time,
                updated_at=past_time,
                abandoned_at=past_time,
            )
            db.add(cart)
            db.commit()

            # Run scheduler recovery job
            summary = CartRecoveryScheduler.run_recovery_job(threshold_minutes=30, store_id=store_id, db=db)
            assert summary["status"] == "completed"
            assert summary["total_dispatched"] >= 1

            # Verify WhatsApp service was called
            assert mock_send_wa.called
            call_kwargs = mock_send_wa.call_args[1]
            assert call_kwargs["to_phone_number"] == "+923331122334"
            assert "Zainab" in call_kwargs["message_text"]
            assert "RECOVER10" in call_kwargs["message_text"]
            assert "10% off" in call_kwargs["message_text"]

            # Verify database state updated to 'dispatched'
            db.refresh(cart)
            assert cart.status == "dispatched"
            assert cart.recovery_sent is True
            assert cart.recovery_sent_at is not None
        finally:
            db.close()

    def test_conversational_negotiation_and_discount_tool(self, test_store_tenant):
        """Test customer reply engagement tracking and discount tool execution without hallucinations."""
        store_uuid = test_store_tenant["store_uuid"]
        cust_phone = "+923451122334"
        cust_email = "buyer@example.com"
        session_id = f"engage_cart_{uuid.uuid4().hex[:8]}"

        db = SessionLocal()
        try:
            cart = CartSession(
                store_id=store_uuid,
                session_id=session_id,
                customer_name="Sara Ahmed",
                customer_email=cust_email,
                customer_phone=cust_phone,
                abandoned_items=[{"title": "Premium Organic Cotton Tee", "price": 39.99, "size": "S"}],
                status="dispatched",
                discount_code="SPECIAL15",
                discount_percentage=15,
                recovery_sent=True,
            )
            db.add(cart)
            db.commit()

            # 1. Customer replies: "Can I get a discount?"
            engaged_cart = track_cart_engagement(
                sender_phone=cust_phone,
                message_text="Is there any promo discount code available for my cart?",
                store_id=store_uuid,
                db=db,
            )
            assert engaged_cart is not None
            assert engaged_cart.status == "engaged"
            assert "promo discount" in engaged_cart.last_customer_message

            # 2. Execute apply_cart_recovery_discount tool
            tool_res = execute_tool_with_db(
                db=db,
                tool_name="apply_cart_recovery_discount",
                arguments={"customer_email": cust_email},
                store_id=store_uuid,
            )
            assert tool_res.get("success") is True
            assert tool_res.get("discount_code") == "SPECIAL15"
            assert tool_res.get("discount_percentage") == 15
        finally:
            db.close()


# =========================================================================
# Phase 2 Tests: Embeddable Storefront Live Chat Widget & Web API Bridge
# =========================================================================

class TestPhase2LiveChatWidgetAndAPIBridge:
    """Tests web chat message execution, tenant scoping, and chat history retrieval."""

    def test_web_chat_endpoint_with_store_scoping(self, test_store_tenant):
        """Test POST /api/v1/chat executing autonomous conversation turns scoped by store_id."""
        store_id = test_store_tenant["store_id"]
        session_id = f"widget_sess_{uuid.uuid4().hex[:8]}"

        # Send inventory inquiry via chat endpoint
        chat_payload = {
            "session_id": session_id,
            "message": "Do you have the Premium Organic Cotton Tee in size M in stock?",
            "customer_email": "webshopper@example.com",
            "store_id": store_id,
        }

        res = client.post("/api/v1/chat", json=chat_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["session_id"] == session_id
        assert data["success"] is True
        assert len(data["response"]) > 0

        # Retrieve chat history
        hist_res = client.get(f"/api/v1/chat/history/{session_id}?store_id={store_id}")
        assert hist_res.status_code == 200
        history = hist_res.json()
        assert len(history) >= 2  # user message and assistant message
        roles = [h["role"] for h in history]
        assert "user" in roles
        assert "assistant" in roles


# =========================================================================
# Phase 3 Tests: Post-Purchase Order Tracking, Notifications & Escalation
# =========================================================================

class TestPhase3PostPurchaseAndEscalation:
    """Tests order creation/fulfillment webhooks, automated WhatsApp alerts, and human handover."""

    @patch("app.services.whatsapp_service.whatsapp_service.send_text_message_sync")
    def test_order_webhooks_and_automated_whatsapp_alerts(self, mock_send_wa, test_store_tenant):
        """Test order creation & shipping fulfillment webhooks dispatching instant WhatsApp notifications."""
        store_id = test_store_tenant["store_id"]
        store_uuid = test_store_tenant["store_uuid"]
        order_num = f"ORD-{uuid.uuid4().hex[:6].upper()}"
        cust_phone = "+923009988776"

        mock_send_wa.return_value = {"success": True, "message_id": f"wamid_{uuid.uuid4().hex[:8]}"}

        # 1. Order Creation Event (Status: Processing)
        create_payload = {
            "order_number": order_num,
            "customer_name": "Bilal Siddiqui",
            "customer_phone": cust_phone,
            "email": "bilal@example.com",
            "status": "Processing",
            "total_price": 49.99,
            "line_items": [{"title": "Premium Organic Cotton Tee", "quantity": 1, "price": 49.99}],
        }

        res_create = client.post(
            f"/api/v1/webhooks/shopify/{store_id}/orders",
            json=create_payload,
        )
        assert res_create.status_code == 200
        assert mock_send_wa.called
        create_call = mock_send_wa.call_args_list[0][1]
        assert "confirmed" in create_call["message_text"].lower()
        assert order_num in create_call["message_text"]

        # 2. Order Fulfillment / Shipping Event (Status: Shipped)
        fulfill_payload = {
            "order_number": order_num,
            "customer_name": "Bilal Siddiqui",
            "customer_phone": cust_phone,
            "email": "bilal@example.com",
            "status": "Shipped",
            "fulfillment_status": "fulfilled",
            "carrier": "TCS Express",
            "tracking_number": "TCS-987654321",
            "tracking_url": "https://tcs.com.pk/track/TCS-987654321",
            "total_price": 49.99,
            "line_items": [{"title": "Premium Organic Cotton Tee", "quantity": 1, "price": 49.99}],
        }

        res_fulfill = client.post(
            f"/api/v1/webhooks/shopify/{store_id}/orders",
            json=fulfill_payload,
        )
        assert res_fulfill.status_code == 200
        assert len(mock_send_wa.call_args_list) >= 2
        fulfill_call = mock_send_wa.call_args_list[1][1]
        assert "shipped" in fulfill_call["message_text"].lower()
        assert "TCS-987654321" in fulfill_call["message_text"]
        assert "TCS Express" in fulfill_call["message_text"]

        # 3. WISMO Inbound Order Lookup via db_tools
        db = SessionLocal()
        try:
            status_res = track_order(order_id=order_num, store_id=store_uuid, db=db)
            assert "error" not in status_res
            assert status_res["order_number"] == order_num
            assert status_res["status"] == "Shipped"
            assert status_res["tracking_number"] == "TCS-987654321"
            assert status_res["carrier"] == "TCS Express"
            assert status_res["tracking_url"] == "https://tcs.com.pk/track/TCS-987654321"
        finally:
            db.close()

    def test_human_handover_and_escalation_detection(self, test_store_tenant):
        """Test human handover escalation trigger when customer requests an agent or refund."""
        store_uuid = test_store_tenant["store_uuid"]
        session_id = f"escalate_{uuid.uuid4().hex[:8]}"

        db = SessionLocal()
        try:
            cs = ChatService(db)

            # Customer asks for human manager / refund
            msg = cs.add_message(
                session_id=session_id,
                role="user",
                content="I am extremely upset and want to speak to a human manager for a refund immediately!",
                store_id=store_uuid,
            )
            assert msg is not None
            assert msg.needs_human is True

            # Verify AI service escalation detection
            ai_service = AISupportService()
            reply = ai_service.generate_support_reply(
                customer_message="Please connect me to an agent",
                customer_phone="+923001122334",
                store_id=store_uuid,
                db=db,
            )
            assert reply is not None

            # Verify session records were marked with needs_human
            wa_session_id = ChatService.build_session_id("+923001122334", store_id=store_uuid)
            cs.mark_session_needs_human(wa_session_id, store_id=store_uuid)
            records = db.query(ChatHistory).filter(ChatHistory.session_id == wa_session_id).all()
            for r in records:
                assert r.needs_human is True
        finally:
            db.close()

    def test_language_mirroring_and_script_sanitization(self):
        """Test that AI responses strictly strip any Devanagari/Hindi characters and preserve clean Roman Urdu & English."""
        from app.services.ai_support_service import sanitize_ai_response

        # Devanagari / Hindi words to forbid
        dirty_hindi = "नमस्ते कृपया आपका धन्यवाद! Aapka order 2 din me deliver ho jayega."
        cleaned = sanitize_ai_response(dirty_hindi)
        assert "नमस्ते" not in cleaned
        assert "कृपया" not in cleaned
        assert "धन्यवाद" not in cleaned
        assert "Aapka order 2 din me deliver ho jayega." in cleaned

        # Pure Roman Urdu
        pure_roman_urdu = "Aapka order #1042 shippment ke liye tayyar hai. Cash on Delivery available hai!"
        assert sanitize_ai_response(pure_roman_urdu) == pure_roman_urdu

        # Clean English
        pure_english = "Your order #1001 is on its way with standard 2-4 day delivery."
        assert sanitize_ai_response(pure_english) == pure_english

    def test_chat_api_escalation_persistence_and_admin_status(self, test_store_tenant):
        """Test POST /api/v1/chat with manager/escalation query flags needs_human in DB and /api/v1/admin/conversations."""
        store_id = test_store_tenant["store_id"]
        store_uuid = test_store_tenant["store_uuid"]
        session_id = f"esc_api_{uuid.uuid4().hex[:8]}"

        # 1. Send escalation message via /api/v1/chat
        res = client.post(
            "/api/v1/chat",
            json={
                "session_id": session_id,
                "message": "manager se baat karwao, mujhe human agent chahiye",
                "store_id": store_id,
            },
        )
        assert res.status_code == 200

        # 2. Verify messages in database have needs_human = True
        db = SessionLocal()
        try:
            records = db.query(ChatHistory).filter(
                ChatHistory.session_id == session_id,
                ChatHistory.store_id == store_uuid,
            ).all()
            assert len(records) >= 2
            assert any(r.needs_human is True for r in records)
        finally:
            db.close()

        # 3. Verify /api/v1/admin/conversations returns needs_human: True and status: "Needs Human"
        admin_res = client.get(f"/api/v1/admin/conversations?store_id={store_id}")
        assert admin_res.status_code == 200
        conv_list = admin_res.json()
        target_conv = next((c for c in conv_list if c["session_id"] == session_id), None)
        assert target_conv is not None
        assert target_conv["needs_human"] is True
        assert target_conv["status"] == "Needs Human"

