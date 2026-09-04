"""
Admin Endpoints: Provides aggregated metrics, conversation history index,
product catalog list, orders, and automated WhatsApp cart recovery triggers.
All handlers wrap logic in try/except blocks to ensure CORS headers and clean JSON responses.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.core.database import get_db
from app.models.order import Order
from app.models.product import Product
from app.models.cart import CartSession
from app.models.chat import ChatHistory
from app.services.cart_recovery import (
    cart_recovery_service,
    dispatch_cart_recovery,
    process_abandoned_cart_recoveries,
)

router = APIRouter()


@router.get(
    "/admin/stats",
    summary="Merchant Dashboard KPI Metrics",
    description="Returns high-level statistics for conversations, orders, low-stock alerts, and cart recovery."
)
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total_sessions = db.query(func.count(distinct(ChatHistory.session_id))).scalar() or 0
        total_messages = db.query(func.count(ChatHistory.id)).scalar() or 0
        total_orders = db.query(func.count(Order.id)).scalar() or 0
        shipped_orders = db.query(func.count(Order.id)).filter(Order.status == "Shipped").scalar() or 0

        # Calculate low stock (products where stock <= 5 or any variant has stock == 0)
        products = db.query(Product).all()
        low_stock_count = 0
        for p in products:
            if p.stock_quantity <= 5:
                low_stock_count += 1
            elif any(v.get("stock", 0) == 0 for v in (p.size_variants or [])):
                low_stock_count += 1

        # Cart recovery stats
        total_carts = db.query(func.count(CartSession.id)).scalar() or 0
        eligible_carts = db.query(func.count(CartSession.id)).filter(CartSession.discount_eligible == True).scalar() or 0
        recovered_carts = db.query(func.count(CartSession.id)).filter(CartSession.is_recovered == True).scalar() or 0
        recovery_rate = round((eligible_carts / max(total_carts, 1)) * 100, 1)

        return {
            "total_conversations": total_sessions,
            "total_messages": total_messages,
            "total_orders": total_orders,
            "shipped_orders": shipped_orders,
            "low_stock_alerts": low_stock_count,
            "total_cart_sessions": total_carts,
            "cart_recovery_rate_pct": recovery_rate,
        }
    except Exception as e:
        print(f"[ERROR] /admin/stats failed: {e}")
        return {
            "total_conversations": 0,
            "total_messages": 0,
            "total_orders": 0,
            "shipped_orders": 0,
            "low_stock_alerts": 0,
            "total_cart_sessions": 0,
            "cart_recovery_rate_pct": 0.0,
            "error": str(e),
        }


@router.get(
    "/admin/conversations",
    summary="List all chat sessions with summary",
    description="Returns a list of unique session IDs with latest timestamp, message count, and preview."
)
def list_conversations(db: Session = Depends(get_db)):
    try:
        sessions = db.query(distinct(ChatHistory.session_id)).all()
        results = []

        for (s_id,) in sessions:
            msgs = db.query(ChatHistory).filter(
                ChatHistory.session_id == s_id
            ).order_by(ChatHistory.created_at.asc()).all()

            if not msgs:
                continue

            first_user_msg = next((m.content for m in msgs if m.role == "user"), "New conversation")
            last_msg = msgs[-1]

            # Check if tools were used in this conversation
            tools_used = [m.name for m in msgs if m.role == "tool" and m.name]
            channel = "WhatsApp" if s_id.startswith("wa_") else "Web Widget"

            results.append({
                "session_id": s_id,
                "channel": channel,
                "message_count": len(msgs),
                "preview": first_user_msg,
                "last_active": last_msg.created_at.isoformat() if last_msg.created_at else None,
                "tools_used": list(set(tools_used)),
                "status": "Resolved" if len(msgs) > 1 else "Active",
            })

        # Sort most recent first
        results.sort(key=lambda x: x.get("last_active") or "", reverse=True)
        return results
    except Exception as e:
        print(f"[ERROR] /admin/conversations failed: {e}")
        return []


@router.get(
    "/admin/products",
    summary="List all catalog products",
    description="Returns products with current stock counts and variant details."
)
def list_products(db: Session = Depends(get_db)):
    try:
        products = db.query(Product).order_by(Product.id.asc()).all()
        return [p.to_dict() for p in products]
    except Exception as e:
        print(f"[ERROR] /admin/products failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=[],
            headers={"X-Error-Message": str(e)},
        )


@router.get(
    "/admin/orders",
    summary="List all store orders",
    description="Returns customer orders with live fulfillment status and tracking."
)
def list_orders(db: Session = Depends(get_db)):
    try:
        orders = db.query(Order).order_by(Order.created_at.desc()).all()
        return [o.to_dict() for o in orders]
    except Exception as e:
        print(f"[ERROR] /admin/orders failed: {e}")
        return []


@router.post(
    "/admin/recovery/trigger-whatsapp",
    summary="Trigger Automated WhatsApp Abandoned Cart Recovery",
    description="Dispatches personalized WhatsApp recovery messages with discount codes for all unrecovered carts."
)
def trigger_whatsapp_cart_recovery(
    session_id: Optional[str] = Query(None, description="Optional specific cart session ID to recover"),
    include_already_sent: bool = Query(False, description="If true, re-send to carts that already received recovery messages"),
    db: Session = Depends(get_db),
):
    """
    Automated WhatsApp Abandoned Cart Recovery dispatcher.
    Evaluates cart sessions, composes personalized promotional WhatsApp messages,
    and dispatches them via Meta Cloud API.
    """
    try:
        if session_id:
            cart = db.query(CartSession).filter(CartSession.session_id == session_id).first()
            if not cart:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={"success": False, "error": f"Cart session '{session_id}' not found."},
                )
            result = cart_recovery_service.recover_cart_session(db, cart)
            return {"success": True, "mode": "single", "result": result}
        else:
            batch_result = cart_recovery_service.dispatch_all_abandoned_carts(
                db=db,
                include_already_sent=include_already_sent,
            )
            return {"success": True, "mode": "batch", "result": batch_result}
    except Exception as e:
        print(f"[ERROR] WhatsApp cart recovery trigger failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": str(e)},
        )


@router.post(
    "/admin/recovery/run-cron-now",
    summary="Manually Trigger Abandoned Cart Recovery Cron Job",
    description="Immediately runs the automated abandoned cart evaluation and recovery worker without waiting for the periodic 15-minute schedule."
)
def run_abandoned_cart_cron_now(
    threshold_minutes: Optional[int] = Query(None, description="Optional custom abandonment threshold in minutes (defaults to configured threshold, e.g. 30)"),
    db: Session = Depends(get_db),
):
    """
    Manual admin trigger for the background recovery worker.
    Evaluates all carts matching abandoned recovery criteria and dispatches WhatsApp messages.
    """
    try:
        result = process_abandoned_cart_recoveries(
            threshold_minutes=threshold_minutes,
            db=db,
        )
        return {"success": True, "result": result}
    except Exception as e:
        print(f"[ERROR] Manual cart recovery cron run failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "error": str(e)},
        )

