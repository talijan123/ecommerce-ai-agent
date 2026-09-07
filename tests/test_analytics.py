"""
Unit & Integration Tests for Enterprise Proactive Nudges & Merchant ROI Analytics Dashboard.
Tests /api/v1/analytics/dashboard-metrics for:
- Accurate Recovered Revenue & Recovery Rate % calculation
- AI Support Auto-Resolution Rate % & Support Hours/Labor Costs Saved math
- Strict Tenant store_id scoping & data isolation
- 7-Day Time Series Trend aggregation
- Live Recovery Stream feed payload formatting
"""

import sys
import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.cart import CartSession
from app.models.chat import ChatHistory
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def store_a(db_session):
    store = Store(
        name=f"Enterprise Store A {uuid.uuid4().hex[:6]}",
        owner_email=f"owner_a_{uuid.uuid4().hex[:6]}@example.com",
        whatsapp_phone_number_id=f"phone_a_{uuid.uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)
    return store


@pytest.fixture
def store_b(db_session):
    store = Store(
        name=f"Enterprise Store B {uuid.uuid4().hex[:6]}",
        owner_email=f"owner_b_{uuid.uuid4().hex[:6]}@example.com",
        whatsapp_phone_number_id=f"phone_b_{uuid.uuid4().hex[:8]}",
        is_active=True,
    )
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)
    return store


class TestMerchantRoiAnalytics:
    """Test suite for /api/v1/analytics/dashboard-metrics endpoint."""

    def test_dashboard_metrics_empty_store(self, store_a):
        """Test that an empty store returns zeroed metrics without crashing."""
        res = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_a.id}")
        assert res.status_code == 200
        data = res.json()

        assert data["recovered_revenue"] == 0.0
        assert data["recovered_revenue_formatted"] == "$0.00"
        assert data["total_abandoned_carts"] == 0
        assert data["recovered_carts_count"] == 0
        assert data["recovery_rate_pct"] == 0.0
        assert data["total_conversations"] == 0
        assert data["ai_resolution_rate_pct"] == 100.0
        assert data["support_hours_saved"] == 0.0
        assert len(data["weekly_revenue_trend"]) == 7
        assert data["recent_recoveries"] == []

    def test_recovered_revenue_and_rate_calculations(self, db_session, store_a):
        """Test calculation of recovered revenue, recovered count, and recovery %."""
        # 1. Cart 1: Recovered ($120)
        c1 = CartSession(
            store_id=store_a.id,
            session_id=f"cs_{uuid.uuid4().hex[:10]}",
            customer_name="Ahmad Hassan",
            customer_phone="+923001234567",
            customer_email=f"ahmad_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[
                {"title": "Classic Oxford Shirt", "size": "L", "quantity": 1, "price": 70.0},
                {"title": "Slim Fit Chinos", "size": "32", "quantity": 1, "price": 50.0},
            ],
            discount_code="RECOVER10",
            discount_percentage=10,
            is_recovered=True,
            status="recovered",
            customer_response_at=datetime.now(timezone.utc),
        )

        # 2. Cart 2: Recovered ($80)
        c2 = CartSession(
            store_id=store_a.id,
            session_id=f"cs_{uuid.uuid4().hex[:10]}",
            customer_name="Sara Khan",
            customer_phone="+923007654321",
            customer_email=f"sara_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[
                {"title": "Leather Handbag", "quantity": 1, "price": 80.0},
            ],
            discount_code="RECOVER10",
            discount_percentage=10,
            is_recovered=True,
            status="recovered",
            customer_response_at=datetime.now(timezone.utc),
        )

        # 3. Cart 3: Unrecovered ($50)
        c3 = CartSession(
            store_id=store_a.id,
            session_id=f"cs_{uuid.uuid4().hex[:10]}",
            customer_name="Zayn Malik",
            customer_phone="+923009998877",
            customer_email=f"zayn_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[
                {"title": "Running Cap", "quantity": 2, "price": 25.0},
            ],
            is_recovered=False,
            status="pending",
        )

        db_session.add_all([c1, c2, c3])
        db_session.commit()

        # Query metrics
        res = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_a.id}")
        assert res.status_code == 200
        data = res.json()

        assert data["total_abandoned_carts"] == 3
        assert data["recovered_carts_count"] == 2
        assert data["recovered_revenue"] == 200.0  # 120 + 80
        assert data["recovered_revenue_formatted"] == "$200.00"
        assert data["recovery_rate_pct"] == 66.7  # (2/3) * 100

        # Check live stream
        assert len(data["recent_recoveries"]) == 3
        summaries = [item["product_summary"] for item in data["recent_recoveries"]]
        assert any("Classic Oxford Shirt" in s for s in summaries)
        assert any("Leather Handbag" in s for s in summaries)
        assert any("Running Cap" in s for s in summaries)

    def test_ai_resolution_rate_and_support_hours_saved(self, db_session, store_a):
        """Test auto-resolution % and support hours saved calculations."""
        sess1 = f"sess_auto_1_{uuid.uuid4().hex[:6]}"
        sess2 = f"sess_auto_2_{uuid.uuid4().hex[:6]}"
        sess3 = f"sess_human_{uuid.uuid4().hex[:6]}"

        # Session 1: Auto-resolved (no needs_human)
        msg1_1 = ChatHistory(store_id=store_a.id, session_id=sess1, role="user", content="Where is my order #1001?")
        msg1_2 = ChatHistory(store_id=store_a.id, session_id=sess1, role="assistant", content="Order #1001 is out for delivery with DHL!")

        # Session 2: Auto-resolved (no needs_human)
        msg2_1 = ChatHistory(store_id=store_a.id, session_id=sess2, role="user", content="Do you have size 42 in sneakers?")
        msg2_2 = ChatHistory(store_id=store_a.id, session_id=sess2, role="assistant", content="Yes, size 42 is available in stock!")

        # Session 3: Escalated (needs_human = True)
        msg3_1 = ChatHistory(store_id=store_a.id, session_id=sess3, role="user", content="I received broken item, want a full refund")
        msg3_2 = ChatHistory(store_id=store_a.id, session_id=sess3, role="assistant", content="I am connecting you to our human support manager.", needs_human=True)

        db_session.add_all([msg1_1, msg1_2, msg2_1, msg2_2, msg3_1, msg3_2])
        db_session.commit()

        # Query metrics
        res = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_a.id}")
        assert res.status_code == 200
        data = res.json()

        assert data["total_conversations"] == 3
        assert data["auto_resolved_conversations"] == 2
        assert data["escalated_conversations"] == 1
        assert data["ai_resolution_rate_pct"] == 66.7  # (2/3) * 100
        # 2 auto-resolved conversations * 8 mins = 16 mins = 0.3 hours
        assert data["support_hours_saved"] == 0.3
        # 0.3 hours * $15 = $4.5
        assert data["support_cost_saved"] == 4.5

    def test_tenant_scoping_isolation(self, db_session, store_a, store_b):
        """Test strict data isolation: Store A metrics do not include Store B revenue."""
        # Store A: 1 cart ($100, recovered)
        cA = CartSession(
            store_id=store_a.id,
            session_id=f"cs_a_{uuid.uuid4().hex[:10]}",
            customer_name="Customer Store A",
            customer_email=f"customera_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[{"title": "Item A", "quantity": 1, "price": 100.0}],
            is_recovered=True,
            status="recovered",
            customer_response_at=datetime.now(timezone.utc),
        )

        # Store B: 1 cart ($500, recovered)
        cB = CartSession(
            store_id=store_b.id,
            session_id=f"cs_b_{uuid.uuid4().hex[:10]}",
            customer_name="Customer Store B",
            customer_email=f"customerb_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[{"title": "Item B", "quantity": 1, "price": 500.0}],
            is_recovered=True,
            status="recovered",
            customer_response_at=datetime.now(timezone.utc),
        )

        db_session.add_all([cA, cB])
        db_session.commit()

        # Store A check
        resA = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_a.id}")
        assert resA.status_code == 200
        dataA = resA.json()
        assert dataA["recovered_revenue"] == 100.0
        assert dataA["total_abandoned_carts"] == 1

        # Store B check
        resB = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_b.id}")
        assert resB.status_code == 200
        dataB = resB.json()
        assert dataB["recovered_revenue"] == 500.0
        assert dataB["total_abandoned_carts"] == 1

    def test_dynamic_pkr_currency_formatting(self, db_session, store_a):
        """Test that PKR currency in cart items formats metrics with Rs. prefix."""
        c_pkr = CartSession(
            store_id=store_a.id,
            session_id=f"cs_pkr_{uuid.uuid4().hex[:10]}",
            customer_name="Usman Tariq",
            customer_email=f"usman_{uuid.uuid4().hex[:6]}@example.com",
            abandoned_items=[
                {"title": "Kurta Shalwar", "quantity": 1, "price": 14500.0, "currency": "PKR"}
            ],
            is_recovered=True,
            status="recovered",
            customer_response_at=datetime.now(timezone.utc),
        )
        db_session.add(c_pkr)
        db_session.commit()

        res = client.get(f"/api/v1/analytics/dashboard-metrics?store_id={store_a.id}")
        assert res.status_code == 200
        data = res.json()

        assert data["currency"] == "PKR"
        assert data["currency_symbol"] == "Rs. "
        assert data["recovered_revenue"] == 14500.0
        assert "Rs. 14,500.00" in data["recovered_revenue_formatted"]
        assert len(data["recent_recoveries"]) > 0
        assert "Rs. 14,500.00" in data["recent_recoveries"][0]["cart_value_formatted"]
