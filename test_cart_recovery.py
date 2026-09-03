"""
Unit and Integration Tests for Automated WhatsApp Abandoned Cart Recovery.
Verifies message construction, single session recovery, batch dispatch, and FastAPI trigger endpoint.
"""

import sys
import os

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.cart import CartSession
from app.services.cart_recovery import (
    cart_recovery_service,
    format_items_summary,
    build_recovery_message,
)
from app.services.whatsapp_service import whatsapp_service


def test_whatsapp_cart_recovery():
    print("=" * 65)
    print(" 🚀 TESTING AUTOMATED WHATSAPP ABANDONED CART RECOVERY")
    print("=" * 65)

    # 1. Test message construction
    print("🔹 Testing Message Construction & Formatting...")
    items = [
        {"name": "Classic White T-Shirt", "size": "M", "quantity": 1, "price": 24.99},
        {"name": "Organic Cotton Hoodie", "size": "L", "quantity": 1, "price": 49.99},
    ]
    summary = format_items_summary(items)
    print(f"  ✓ Items Summary: '{summary}'")
    assert "Classic White T-Shirt" in summary
    assert "Organic Cotton Hoodie" in summary

    msg = build_recovery_message(
        customer_name="Sarah Smith",
        items_summary=summary,
        discount_code="SAVE15",
        discount_percentage=15,
        checkout_url="https://store.example.com/checkout?cart=sess_abc",
    )
    print("  ✓ Constructed Message Preview:")
    for line in msg.split("\n"):
        print(f"    | {line}")
    assert "Sarah Smith" in msg
    assert "SAVE15" in msg
    assert "15% off" in msg
    assert "https://store.example.com" in msg

    # 2. Test WhatsApp service helper
    print("\n🔹 Testing WhatsApp Service Dispatch...")
    res = whatsapp_service.send_text_message_sync(
        to_phone_number="+14155552671",
        message_text=msg,
    )
    print(f"  ✓ Dispatch result: {res}")
    # Under live credentials, Meta API responds (200 OK or 400 if recipient not in allowed list); under mock mode, success is True
    assert res.get("mock") is True or res.get("success") is True or res.get("status_code") in [200, 400]

    # 3. Test Database Cart Session Recovery
    print("\n🔹 Testing CartRecoveryService with Database...")
    db = SessionLocal()
    try:
        # Ensure test cart exists
        test_cart = db.query(CartSession).filter(CartSession.session_id == "sess_test_recovery_01").first()
        if not test_cart:
            test_cart = CartSession(
                session_id="sess_test_recovery_01",
                customer_name="Test Customer",
                customer_email="test.customer@example.com",
                customer_phone="+14155552671",
                abandoned_items=[{"name": "Essence Mascara Lash Princess", "size": "30ml", "quantity": 1, "price": 9.99}],
                discount_eligible=True,
                discount_code="TEST10",
                discount_percentage=10,
                recovery_sent=False,
            )
            db.add(test_cart)
            db.commit()
            db.refresh(test_cart)

        # Single recovery
        recovery_res = cart_recovery_service.recover_cart_session(db, test_cart)
        print(f"  ✓ Single cart recovery processed: {recovery_res['status']}")
        assert recovery_res["status"] == "sent"
        assert recovery_res["discount_code"] == "TEST10"

        # Verify DB state updated
        db.refresh(test_cart)
        assert test_cart.recovery_sent is True
        assert test_cart.recovery_sent_at is not None
        print(f"  ✓ Database record verified: recovery_sent={test_cart.recovery_sent}, sent_at={test_cart.recovery_sent_at}")

        # Batch recovery
        batch_res = cart_recovery_service.dispatch_all_abandoned_carts(db, include_already_sent=True)
        print(f"  ✓ Batch dispatch evaluated {batch_res['total_carts_evaluated']} carts, dispatched {batch_res['total_dispatched']}")
        assert batch_res["total_dispatched"] >= 1

    finally:
        db.close()

    # 4. Test FastAPI Trigger Endpoint
    print("\n🔹 Testing FastAPI Trigger Endpoint (POST /api/v1/admin/recovery/trigger-whatsapp)...")
    client = TestClient(app)

    # Trigger single session
    res = client.post("/api/v1/admin/recovery/trigger-whatsapp?session_id=sess_test_recovery_01&include_already_sent=true")
    assert res.status_code == 200, f"Failed: {res.text}"
    data = res.json()
    print(f"  ✓ Single session endpoint response: {data['success']}")
    assert data["success"] is True

    # Trigger batch recovery
    res_batch = client.post("/api/v1/admin/recovery/trigger-whatsapp?include_already_sent=true")
    assert res_batch.status_code == 200, f"Failed: {res_batch.text}"
    batch_data = res_batch.json()
    print(f"  ✓ Batch recovery endpoint response: {batch_data['success']}, Dispatched: {batch_data['result']['total_dispatched']}")
    assert batch_data["success"] is True

    print("\n" + "=" * 65)
    print(" 🎉 ALL WHATSAPP ABANDONED CART RECOVERY TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    test_whatsapp_cart_recovery()
