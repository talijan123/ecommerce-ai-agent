import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine, ensure_db_initialized
from app.core.scheduler import scheduler, start_scheduler, shutdown_scheduler
from app.models.cart import CartSession
from app.services.cart_recovery import (
    cart_recovery_service,
    format_items_summary,
    build_recovery_message,
    dispatch_cart_recovery,
    process_abandoned_cart_recoveries,
)
from app.services.whatsapp_service import whatsapp_service


def test_whatsapp_cart_recovery():
    print("=" * 65)
    print(" 🚀 TESTING AUTOMATED WHATSAPP ABANDONED CART RECOVERY & SCHEDULER")
    print("=" * 65)

    ensure_db_initialized()


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
    # Under live credentials, Meta API responds with success or HTTP status; under mock mode, mock is True
    assert res.get("mock") is True or res.get("success") is not None or res.get("status_code") is not None

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
                created_at=datetime.now(timezone.utc) - timedelta(minutes=45),
                updated_at=datetime.now(timezone.utc) - timedelta(minutes=45),
            )
            db.add(test_cart)
            db.commit()
            db.refresh(test_cart)

        # Single recovery via dispatch_cart_recovery helper
        recovery_res = dispatch_cart_recovery("sess_test_recovery_01", db=db)
        print(f"  ✓ Single cart recovery processed: {recovery_res.get('status')}")
        assert recovery_res["status"] == "sent"
        assert recovery_res["discount_code"] == "TEST10"

        # Verify DB state updated
        db.refresh(test_cart)
        assert test_cart.recovery_sent is True
        assert test_cart.recovery_sent_at is not None
        print(f"  ✓ Database record verified: recovery_sent={test_cart.recovery_sent}, sent_at={test_cart.recovery_sent_at}")

        # Batch recovery via dispatch_all_abandoned_carts
        batch_res = cart_recovery_service.dispatch_all_abandoned_carts(db, include_already_sent=True)
        print(f"  ✓ Batch dispatch evaluated {batch_res['total_carts_evaluated']} carts, dispatched {batch_res['total_dispatched']}")
        assert batch_res["total_dispatched"] >= 1

    finally:
        db.close()

    # 4. Test Periodic Cron Function process_abandoned_cart_recoveries
    print("\n🔹 Testing process_abandoned_cart_recoveries Cron Function...")
    db = SessionLocal()
    try:
        # Create an abandoned cart older than 30 mins
        cron_test_cart = db.query(CartSession).filter(CartSession.session_id == "sess_cron_test_30m").first()
        if not cron_test_cart:
            cron_test_cart = CartSession(
                session_id="sess_cron_test_30m",
                customer_name="Cron User",
                customer_email="cron.user@example.com",
                customer_phone="+14155552671",
                abandoned_items=[{"name": "Lipstick Red", "size": "Standard", "quantity": 1, "price": 14.99}],
                discount_eligible=True,
                discount_code="CRON10",
                discount_percentage=10,
                is_recovered=False,
                recovery_sent=False,
                created_at=datetime.now(timezone.utc) - timedelta(minutes=35),
                updated_at=datetime.now(timezone.utc) - timedelta(minutes=35),
            )
            db.add(cron_test_cart)
            db.commit()
        else:
            cron_test_cart.recovery_sent = False
            cron_test_cart.is_recovered = False
            cron_test_cart.created_at = datetime.now(timezone.utc) - timedelta(minutes=35)
            cron_test_cart.updated_at = datetime.now(timezone.utc) - timedelta(minutes=35)
            db.commit()

        # Run cron recovery with threshold of 30 mins
        cron_res = process_abandoned_cart_recoveries(threshold_minutes=30, db=db)
        print(f"  ✓ Cron function executed successfully: evaluated {cron_res.get('total_evaluated')}, dispatched {cron_res.get('total_dispatched')}")
        assert cron_res["status"] == "completed"
        assert cron_res["total_dispatched"] >= 1

        # Check that cart is now marked recovery_sent = True
        db.refresh(cron_test_cart)
        assert cron_test_cart.recovery_sent is True
        print(f"  ✓ Eligible cart sess_cron_test_30m recovery_sent verified as True")

    finally:
        db.close()

    # 5. Test APScheduler Initialization & Lifecycle
    print("\n🔹 Testing APScheduler Lifecycle...")
    start_scheduler()
    assert scheduler.running is True
    job = scheduler.get_job("abandoned_cart_recovery_cron")
    assert job is not None
    print(f"  ✓ APScheduler running with registered job: '{job.name}' (ID: {job.id})")

    # 6. Test FastAPI Trigger Endpoints
    print("\n🔹 Testing FastAPI Trigger Endpoints...")
    client = TestClient(app)

    # Legacy / specific trigger endpoint
    res = client.post("/api/v1/admin/recovery/trigger-whatsapp?session_id=sess_test_recovery_01&include_already_sent=true")
    assert res.status_code == 200, f"Failed: {res.text}"
    assert res.json()["success"] is True
    print("  ✓ POST /api/v1/admin/recovery/trigger-whatsapp (single session) succeeded")

    # New manual cron trigger endpoint POST /api/v1/admin/recovery/run-cron-now
    res_cron = client.post("/api/v1/admin/recovery/run-cron-now?threshold_minutes=30")
    assert res_cron.status_code == 200, f"Failed: {res_cron.text}"
    cron_data = res_cron.json()
    assert cron_data["success"] is True
    assert cron_data["result"]["status"] == "completed"
    print(f"  ✓ POST /api/v1/admin/recovery/run-cron-now returned: status={cron_data['result']['status']}, evaluated={cron_data['result']['total_evaluated']}")

    print("\n" + "=" * 65)
    print(" 🎉 ALL WHATSAPP ABANDONED CART RECOVERY & SCHEDULER TESTS PASSED!")
    print("=" * 65)


if __name__ == "__main__":
    test_whatsapp_cart_recovery()

