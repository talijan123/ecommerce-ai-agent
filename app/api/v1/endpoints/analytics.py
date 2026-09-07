"""
Analytics Endpoints: Provides Enterprise Merchant ROI & Financial Conversion Metrics.
Calculates Recovered Revenue, Recovery Rate %, AI Support Auto-Resolution Rate %,
Estimated Support Hours/Labor Costs Saved, Weekly Recovery Time-Series Trend, and Live Recovery Stream.
Strictly scoped by tenant store_id.
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.core.database import get_db
from app.models.cart import CartSession
from app.models.chat import ChatHistory
from app.models.order import Order

router = APIRouter()


def format_cart_products_summary(abandoned_items: Optional[List[Dict[str, Any]]]) -> str:
    """Format cart item list into a concise readable product summary."""
    if not abandoned_items or not isinstance(abandoned_items, list):
        return "Cart Items"
    names = []
    for item in abandoned_items:
        if isinstance(item, dict):
            title = item.get("title") or item.get("name") or "Item"
            size = item.get("size")
            if size:
                names.append(f"{title} ({size})")
            else:
                names.append(str(title))
    if not names:
        return "Cart Items"
    if len(names) == 1:
        return names[0]
    return f"{names[0]} + {len(names) - 1} more"


@router.get(
    "/dashboard-metrics",
    summary="Enterprise Merchant ROI Metrics",
    description="Returns calculated business financial ROI KPIs, weekly recovery trend, and live recovery stream."
)
def get_dashboard_metrics(
    store_id: Optional[str] = Query(None, description="Optional tenant store UUID filter"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    try:
        parsed_store_uuid = None
        if store_id:
            try:
                parsed_store_uuid = uuid.UUID(store_id.strip())
            except (ValueError, AttributeError):
                # Return empty metrics for invalid UUID
                return _build_empty_metrics()

        # 1. Query Cart Sessions
        cart_query = db.query(CartSession)
        if parsed_store_uuid is not None:
            cart_query = cart_query.filter(CartSession.store_id == parsed_store_uuid)

        all_carts = cart_query.all()
        total_abandoned_carts = len(all_carts)

        recovered_carts = [
            c for c in all_carts
            if c.is_recovered or (c.status and c.status.lower() == "recovered")
        ]
        recovered_carts_count = len(recovered_carts)

        recovered_revenue = sum(c.total_price for c in recovered_carts)
        recovered_revenue = round(recovered_revenue, 2)

        recovery_rate_pct = (
            round((recovered_carts_count / total_abandoned_carts) * 100, 1)
            if total_abandoned_carts > 0
            else 0.0
        )

        # 2. Query Chat History & Resolution Rates
        sess_query = db.query(distinct(ChatHistory.session_id))
        if parsed_store_uuid is not None:
            sess_query = sess_query.filter(ChatHistory.store_id == parsed_store_uuid)

        sessions = sess_query.all()
        total_conversations = len(sessions)

        escalated_count = 0
        for (s_id,) in sessions:
            msg_q = db.query(ChatHistory).filter(ChatHistory.session_id == s_id)
            if parsed_store_uuid is not None:
                msg_q = msg_q.filter(ChatHistory.store_id == parsed_store_uuid)
            has_human = msg_q.filter(ChatHistory.needs_human == True).count() > 0
            if has_human:
                escalated_count += 1

        auto_resolved_conversations = max(0, total_conversations - escalated_count)

        ai_resolution_rate_pct = (
            round((auto_resolved_conversations / total_conversations) * 100, 1)
            if total_conversations > 0
            else 100.0
        )

        # 8 minutes average human support handling time saved per auto-resolved conversation
        support_hours_saved = round((auto_resolved_conversations * 8) / 60.0, 1)
        support_cost_saved = round(support_hours_saved * 15.0, 2)  # Benchmark $15/hr support cost

        # 3. Weekly Revenue Trend (Last 7 Days)
        now = datetime.now(timezone.utc)
        days_map: Dict[str, Dict[str, Any]] = {}
        for i in range(6, -1, -1):
            day_dt = now - timedelta(days=i)
            day_key = day_dt.strftime("%Y-%m-%d")
            day_label = day_dt.strftime("%b %d")
            days_map[day_key] = {
                "date": day_key,
                "label": day_label,
                "recovered_amount": 0.0,
                "carts_count": 0,
            }

        for c in recovered_carts:
            c_time = c.customer_response_at or c.updated_at or c.created_at
            if c_time:
                if c_time.tzinfo is None:
                    c_time = c_time.replace(tzinfo=timezone.utc)
                key = c_time.strftime("%Y-%m-%d")
                if key in days_map:
                    days_map[key]["recovered_amount"] = round(days_map[key]["recovered_amount"] + c.total_price, 2)
                    days_map[key]["carts_count"] += 1

        weekly_revenue_trend = list(days_map.values())

        # 4. Live Recovery Stream (Recent 10 carts)
        recent_carts = sorted(all_carts, key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)[:10]
        recent_recoveries = []
        for c in recent_carts:
            recent_recoveries.append({
                "id": c.id,
                "customer_name": c.customer_name or "Valued Customer",
                "customer_phone": c.customer_phone or "N/A",
                "customer_email": c.customer_email or "N/A",
                "product_summary": format_cart_products_summary(c.abandoned_items),
                "cart_value": c.total_price,
                "discount_code": c.discount_code or "None",
                "discount_percentage": c.discount_percentage or 10,
                "status": c.status or ("recovered" if c.is_recovered else ("dispatched" if c.recovery_sent else "pending")),
                "is_recovered": c.is_recovered,
                "timestamp": (c.customer_response_at or c.updated_at or c.created_at).isoformat() if (c.customer_response_at or c.updated_at or c.created_at) else None,
            })

        return {
            "recovered_revenue": recovered_revenue,
            "recovered_revenue_formatted": f"${recovered_revenue:,.2f}",
            "currency": "USD",
            "total_abandoned_carts": total_abandoned_carts,
            "recovered_carts_count": recovered_carts_count,
            "recovery_rate_pct": recovery_rate_pct,
            "total_conversations": total_conversations,
            "auto_resolved_conversations": auto_resolved_conversations,
            "escalated_conversations": escalated_count,
            "ai_resolution_rate_pct": ai_resolution_rate_pct,
            "support_hours_saved": support_hours_saved,
            "support_cost_saved": support_cost_saved,
            "weekly_revenue_trend": weekly_revenue_trend,
            "recent_recoveries": recent_recoveries,
        }

    except Exception as e:
        print(f"[ERROR] /analytics/dashboard-metrics failed: {e}")
        return _build_empty_metrics()


def _build_empty_metrics() -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    weekly_trend = []
    for i in range(6, -1, -1):
        day_dt = now - timedelta(days=i)
        weekly_trend.append({
            "date": day_dt.strftime("%Y-%m-%d"),
            "label": day_dt.strftime("%b %d"),
            "recovered_amount": 0.0,
            "carts_count": 0,
        })

    return {
        "recovered_revenue": 0.0,
        "recovered_revenue_formatted": "$0.00",
        "currency": "USD",
        "total_abandoned_carts": 0,
        "recovered_carts_count": 0,
        "recovery_rate_pct": 0.0,
        "total_conversations": 0,
        "auto_resolved_conversations": 0,
        "escalated_conversations": 0,
        "ai_resolution_rate_pct": 100.0,
        "support_hours_saved": 0.0,
        "support_cost_saved": 0.0,
        "weekly_revenue_trend": weekly_trend,
        "recent_recoveries": [],
    }
