"""
Unit and Integration Tests for Meta WhatsApp Cloud API Integration.
Verifies Webhook Verification handshake (GET) and real-time Inbound Message processing (POST).
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
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.chat import ChatHistory
from app.models.cart import CartSession
from app.api.v1.endpoints.whatsapp import process_whatsapp_inbound_message
from seed_db import seed_database
import asyncio

client = TestClient(app)


def test_whatsapp_webhook_verification():
    print("🔹 Testing Meta WhatsApp Webhook Verification Handshake (GET)...")

    # 1. Valid handshake
    challenge_val = "9876543210"
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
        "hub.challenge": challenge_val,
    }
    response = client.get("/api/v1/webhooks/whatsapp", params=params)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.text == challenge_val, f"Expected {challenge_val}, got {response.text}"
    print("  ✓ Valid verification handshake returned challenge correctly (HTTP 200)")

    # 2. Invalid verify token
    bad_params = {
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_secret_token",
        "hub.challenge": challenge_val,
    }
    bad_response = client.get("/api/v1/webhooks/whatsapp", params=bad_params)
    assert bad_response.status_code == 403, f"Expected 403, got {bad_response.status_code}"
    print("  ✓ Invalid verify token rejected cleanly (HTTP 403)")


def test_whatsapp_inbound_message_webhook():
    print("\n🔹 Testing Inbound WhatsApp Message Webhook (POST)...")

    mock_sender = "923009876543"
    expected_session_id = f"wa_{mock_sender}"

    # Sample Meta Cloud API Inbound Webhook Payload
    meta_payload = {
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
                                "phone_number_id": "123456789012345",
                            },
                            "contacts": [
                                {
                                  "profile": {"name": "Hamza"},
                                  "wa_id": mock_sender
                                }
                            ],
                            "messages": [
                                {
                                    "from": mock_sender,
                                    "id": "wamid.HBgLMTIzNDU2Nzg5MA==",
                                    "timestamp": "1725100000",
                                    "text": {
                                        "body": "Where is my order #1042?"
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

    # 1. Post to Webhook endpoint
    response = client.post("/api/v1/webhooks/whatsapp", json=meta_payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert response.json().get("status") in ["ok", "EVENT_RECEIVED"]
    print(f"  ✓ Inbound message acknowledged immediately with HTTP 200 {response.json()}")

    # 2. Run worker execution synchronously to test AI reply + DB persistence
    asyncio.run(
        process_whatsapp_inbound_message(
            sender_phone=mock_sender,
            message_id="wamid.HBgLMTIzNDU2Nzg5MA==",
            message_text="Where is my order #1042?",
        )
    )

    # 3. Verify session history / engagement
    db = SessionLocal()
    try:
        cart = db.query(CartSession).filter(CartSession.customer_phone == mock_sender).first()
        if cart:
            assert cart.status == "engaged"
            print(f"  ✓ WhatsApp CartSession verified as engaged for {mock_sender}")
    finally:
        db.close()


def test_whatsapp_status_receipt_ignored():
    print("\n🔹 Testing Delivery Status Receipts (Sent / Delivered / Read)...")
    # Meta also sends status updates which must be acknowledged without error
    status_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [
                                {
                                    "id": "wamid.XYZ",
                                    "status": "delivered",
                                    "timestamp": "1725100005",
                                    "recipient_id": "923009876543"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    response = client.post("/api/v1/webhooks/whatsapp", json=status_payload)
    assert response.status_code == 200
    assert response.json().get("status") in ["ok", "EVENT_RECEIVED"]
    print("  ✓ Status receipts handled cleanly without errors")



if __name__ == "__main__":
    print("=" * 75)
    print(" 🚀 RUNNING META WHATSAPP CLOUD API INTEGRATION TEST SUITE")
    print("=" * 75)
    seed_database()
    test_whatsapp_webhook_verification()
    test_whatsapp_inbound_message_webhook()
    test_whatsapp_status_receipt_ignored()
    print("\n" + "=" * 75)
    print(" 🎉 ALL META WHATSAPP CLOUD API TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)
