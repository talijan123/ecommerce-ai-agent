"""
Live Verification Script for Meta WhatsApp Cloud API Integration.
Executes end-to-end checks on:
1. Environment and Pydantic Configuration
2. Meta Cloud API Outbound Text Message Dispatch (Live vs Mock)
3. Meta Webhook Verification Handshake (GET)
4. Abandoned Cart Recovery Trigger Endpoint (POST /api/v1/admin/recovery/trigger-whatsapp)
"""

import sys
import json
import os

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
from app.core.config import settings
from app.services.whatsapp_service import whatsapp_service
from app.core.database import SessionLocal
from app.models.cart import CartSession

client = TestClient(app)


def mask_token(token: str) -> str:
    """Mask sensitive token string for safe logging."""
    if not token or len(token) < 16:
        return token
    return f"{token[:10]}...{token[-8:]} (Length: {len(token)})"


def section(title: str):
    print("\n" + "=" * 75)
    print(f" 🔍 {title}")
    print("=" * 75)


def verify_configuration():
    section("1. ENVIRONMENT & CONFIGURATION CHECK")
    
    token = settings.WHATSAPP_TOKEN
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
    verify_token = settings.WHATSAPP_VERIFY_TOKEN
    api_version = settings.WHATSAPP_API_VERSION

    print(f" • WHATSAPP_TOKEN:           {mask_token(token)}")
    print(f" • WHATSAPP_PHONE_NUMBER_ID: {phone_id}")
    print(f" • WHATSAPP_VERIFY_TOKEN:    {verify_token}")
    print(f" • WHATSAPP_API_VERSION:     {api_version}")
    print(f" • Base Graph URL:           {whatsapp_service.base_url}")
    print(f" • Service is_configured:    {whatsapp_service.is_configured}")

    assert token and len(token) > 20, "❌ WHATSAPP_TOKEN is empty or too short!"
    assert phone_id and len(phone_id) > 5, "❌ WHATSAPP_PHONE_NUMBER_ID is empty or invalid!"
    assert verify_token == "autocommerce_wa_verify_token_123", "❌ WHATSAPP_VERIFY_TOKEN mismatch!"
    assert api_version == "v21.0", "❌ WHATSAPP_API_VERSION mismatch!"
    assert whatsapp_service.is_configured is True, "❌ whatsapp_service.is_configured is False!"

    print("\n✅ Configuration loaded successfully with live credentials enabled!")
    return True


def verify_direct_outbound_dispatch(test_phone: str = "923187806306"):
    section("2. DIRECT OUTBOUND MESSAGE DISPATCH (send_text_message_sync)")
    
    print(f" • Target Recipient: {test_phone}")
    print(f" • Outbound URL:     {whatsapp_service.base_url}/messages")
    test_message = "🤖 AutoCommerce WhatsApp Integration Test - Live Verification Message."
    print(f" • Message Body:     '{test_message}'")
    
    result = whatsapp_service.send_text_message_sync(
        to_phone_number=test_phone,
        message_text=test_message,
    )

    print("\n • Result Payload:")
    print(json.dumps(result, indent=2))

    if result.get("mock") is True:
        print("\n⚠️ WARNING: Message was handled in Mock/Dry-run mode.")
    elif result.get("success") is True:
        data = result.get("data", {})
        messages = data.get("messages", [])
        msg_id = messages[0].get("id") if messages else "N/A"
        status_code = result.get("status_code", 200)
        print(f"\n✅ LIVE DISPATCH SUCCESSFUL!")
        print(f"   - HTTP Status: {status_code}")
        print(f"   - Message ID (WAMID): {msg_id}")
    else:
        status_code = result.get("status_code", "N/A")
        error_info = result.get("error", "Unknown error")
        print(f"\n⚠️ Meta Graph API Returned Error Response (Live Call Executed):")
        print(f"   - HTTP Status: {status_code}")
        print(f"   - Error Details: {error_info}")
        print("   (Note: For Meta Sandbox/Dev numbers, outbound messages succeed when sent to verified recipient numbers)")

    return result


def verify_webhook_verification():
    section("3. META WEBHOOK VERIFICATION HANDSHAKE (GET)")
    
    challenge = "challenge_wa_test_998877"
    params = {
        "hub.mode": "subscribe",
        "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
        "hub.challenge": challenge,
    }
    res = client.get("/api/v1/webhooks/whatsapp", params=params)
    print(f" • GET /api/v1/webhooks/whatsapp -> Status: {res.status_code}")
    print(f" • Response Body: '{res.text}'")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert res.text == challenge, f"Expected challenge string, got {res.text}"
    print("✅ Webhook handshake verified successfully (HTTP 200 with challenge echo)!")


def verify_cart_recovery_endpoint():
    section("4. ABANDONED CART RECOVERY TRIGGER ENDPOINT (POST)")
    
    # 1. Create or retrieve a test cart session in the DB
    db = SessionLocal()
    test_session_id = "sess_live_wa_verify_001"
    try:
        cart = db.query(CartSession).filter(CartSession.session_id == test_session_id).first()
        if not cart:
            cart = CartSession(
                session_id=test_session_id,
                customer_name="Talal Test",
                customer_email="talal.test@example.com",
                customer_phone="923187806306",
                abandoned_items=[
                    {"product_id": 1, "name": "Minimalist Ceramic Lamp", "size": "Standard", "price": 85.0}
                ],
                discount_code="RECOVER15",
                discount_percentage=15,
                recovery_sent=False,
                is_recovered=False,
            )
            db.add(cart)
            db.commit()
            print(f" • Seeded test CartSession: {test_session_id} with phone 923187806306")
        else:
            cart.customer_phone = "923187806306"
            cart.recovery_sent = False
            db.commit()
            print(f" • Updated test CartSession: {test_session_id} with phone 923187806306 and reset recovery_sent=False")
    finally:
        db.close()

    # 2. Trigger recovery for single cart session
    print(f"\n • Calling POST /api/v1/admin/recovery/trigger-whatsapp?session_id={test_session_id}&include_already_sent=true...")
    response = client.post(
        f"/api/v1/admin/recovery/trigger-whatsapp?session_id={test_session_id}&include_already_sent=true"
    )
    print(f" • HTTP Status Code: {response.status_code}")
    payload = response.json()
    print(" • Response JSON:")
    print(json.dumps(payload, indent=2))

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    assert payload.get("success") is True, "Expected success: True"
    
    single_res = payload.get("result", {})
    mock_status = single_res.get("mock", True)
    print(f"\n • Recovery Status: {single_res.get('status')}")
    print(f" • Mock Mode:       {mock_status} (Expected: False for live Meta dispatch)")
    print(f" • Formatted Msg:   \n{single_res.get('message')}")
    
    print("\n✅ Abandoned Cart Recovery endpoint triggered and executed cleanly!")
    return payload


def main():
    print("=" * 75)
    print(" 🚀 WHATSAPP CLOUD API INTEGRATION - END-TO-END VERIFICATION")
    print("=" * 75)

    # 1. Config Check
    verify_configuration()

    # 2. Direct Outbound Dispatch Test
    verify_direct_outbound_dispatch()

    # 3. Webhook Handshake Test
    verify_webhook_verification()

    # 4. Cart Recovery API Trigger Test
    verify_cart_recovery_endpoint()

    print("\n" + "=" * 75)
    print(" 🎉 ALL END-TO-END VERIFICATION CHECKS COMPLETED!")
    print("=" * 75)


if __name__ == "__main__":
    main()
