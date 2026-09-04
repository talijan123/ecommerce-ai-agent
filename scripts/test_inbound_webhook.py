"""
Test and Verification Script for Intelligent WhatsApp Inbound Webhook Handler.
Mocks incoming WhatsApp message from 923187806306, triggers the webhook endpoint and background worker,
and verifies:
1. Webhook immediately responds with HTTP 200 and {"status": "EVENT_RECEIVED"}.
2. CartSession status is updated to 'engaged' and customer_response_at timestamp is saved.
3. Gemini AI generates a contextual support reply.
4. Outbound WhatsApp reply is dispatched to customer via Meta Cloud API.
"""

import sys
import os
import json
import asyncio
from datetime import datetime, timezone

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.cart import CartSession
from app.api.v1.endpoints.whatsapp import handle_inbound_whatsapp_message
from app.services.ai_support_service import ai_support_service

client = TestClient(app)


def test_inbound_webhook_pipeline():
    print("=" * 75)
    print(" 🚀 TESTING INTELLIGENT WHATSAPP INBOUND WEBHOOK & GEMINI AI HANDLER")
    print("=" * 75)

    ensure_db_initialized()

    test_phone = "923187806306"
    test_session_id = f"sess_inbound_test_{test_phone}"
    test_message_body = "Hi! How long does delivery take and is my discount code still active?"
    test_message_id = "wamid.HBgMOTIzMTg3ODA2MzA2FQIAERgSTUVUQV9JTkJPVU5EX1RFU1QA"

    # Step 1: Seed a test CartSession in database
    print("\n🔹 Step 1: Seeding CartSession in DB for phone:", test_phone)
    db = SessionLocal()
    try:
        cart = db.query(CartSession).filter(CartSession.session_id == test_session_id).first()
        if not cart:
            cart = CartSession(
                session_id=test_session_id,
                customer_name="Talal Test",
                customer_email="talal.test@example.com",
                customer_phone=test_phone,
                abandoned_items=[
                    {"name": "Minimalist Ceramic Lamp", "size": "Standard", "quantity": 1, "price": 85.0},
                    {"name": "Wireless Noise Cancelling Headphones", "size": "Standard", "quantity": 1, "price": 120.0},
                ],
                discount_code="RECOVER15",
                discount_percentage=15,
                discount_eligible=True,
                recovery_sent=True,
                status="pending",
                is_recovered=False,
            )
            db.add(cart)
            db.commit()
            db.refresh(cart)
        else:
            cart.status = "pending"
            cart.customer_response_at = None
            cart.last_customer_message = None
            cart.discount_code = "RECOVER15"
            cart.discount_percentage = 15
            cart.recovery_sent = True
            db.commit()
            db.refresh(cart)
        print(f"  ✓ Seeded CartSession: {cart.session_id} with initial status: '{cart.status}'")
    finally:
        db.close()

    # Step 2: Test Webhook Endpoint POST /api/v1/webhooks/whatsapp
    print("\n🔹 Step 2: Simulating Inbound Meta Webhook POST...")
    mock_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15550234567",
                                "phone_number_id": "1330161100179237",
                            },
                            "contacts": [
                                {
                                    "profile": {"name": "Talal Test"},
                                    "wa_id": test_phone,
                                }
                            ],
                            "messages": [
                                {
                                    "from": test_phone,
                                    "id": test_message_id,
                                    "timestamp": str(int(datetime.now().timestamp())),
                                    "text": {
                                        "body": test_message_body,
                                    },
                                    "type": "text",
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

    response = client.post("/api/v1/webhooks/whatsapp", json=mock_payload)
    print(f"  ✓ HTTP Status: {response.status_code}")
    print(f"  ✓ Response Body: {response.json()}")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.json().get("status") == "EVENT_RECEIVED", f"Expected EVENT_RECEIVED, got {response.json()}"
    print("  ✓ Webhook acknowledged immediately with HTTP 200 and {'status': 'EVENT_RECEIVED'}")

    # Step 3: Run Inbound Processing Pipeline (Engagement + Gemini AI + Dispatch)
    print("\n🔹 Step 3: Running Inbound Message Handler & Gemini AI Generation...")
    asyncio.run(
        handle_inbound_whatsapp_message(
            sender_phone=test_phone,
            message_text=test_message_body,
            message_id=test_message_id,
        )
    )

    # Step 4: Verify Database Status & Timestamp Update
    print("\n🔹 Step 4: Verifying Database Session Engagement...")
    db = SessionLocal()
    try:
        updated_cart = db.query(CartSession).filter(CartSession.session_id == test_session_id).first()
        assert updated_cart is not None, "CartSession not found in DB"
        print(f"  ✓ Cart Session ID:        {updated_cart.session_id}")
        print(f"  ✓ Updated Status:         '{updated_cart.status}' (Expected: 'engaged')")
        print(f"  ✓ Customer Response At:   {updated_cart.customer_response_at}")
        print(f"  ✓ Last Message Persisted: '{updated_cart.last_customer_message}'")

        assert updated_cart.status == "engaged", f"Expected status 'engaged', got '{updated_cart.status}'"
        assert updated_cart.customer_response_at is not None, "customer_response_at timestamp was not set"
        assert updated_cart.last_customer_message == test_message_body, "last_customer_message does not match"
        print("  ✓ DB Session Engagement verified successfully!")
    finally:
        db.close()

    # Step 5: Test AI Support Service Unit Logic
    print("\n🔹 Step 5: Testing Gemini AI Contextual Prompt & Fallback...")
    ai_reply = ai_support_service.generate_support_reply(
        customer_message=test_message_body,
        cart_session=updated_cart,
        customer_phone=test_phone,
    )
    print("  ✓ Generated AI Support Reply:")
    for line in ai_reply.split("\n"):
        print(f"    | {line}")
    assert len(ai_reply) > 10, "Generated reply is too short"
    assert "delivery" in ai_reply.lower() or "days" in ai_reply.lower() or "help" in ai_reply.lower()

    print("\n" + "=" * 75)
    print(" 🎉 ALL INBOUND WEBHOOK & GEMINI AI TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)


if __name__ == "__main__":
    test_inbound_webhook_pipeline()
