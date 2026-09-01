"""
Admin Endpoints: Provides aggregated metrics, conversation history index,
product catalog list, and orders for the Merchant Dashboard.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct

from app.core.database import get_db
from app.models.order import Order
from app.models.product import Product
from app.models.cart import CartSession
from app.models.chat import ChatHistory

router = APIRouter()


@router.get(
    "/admin/stats",
    summary="Merchant Dashboard KPI Metrics",
    description="Returns high-level statistics for conversations, orders, low-stock alerts, and cart recovery."
)
def get_dashboard_stats(db: Session = Depends(get_db)):
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


@router.get(
    "/admin/conversations",
    summary="List all chat sessions with summary",
    description="Returns a list of unique session IDs with latest timestamp, message count, and preview."
)
def list_conversations(db: Session = Depends(get_db)):
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


@router.get(
    "/admin/products",
    summary="List all catalog products",
    description="Returns products with current stock counts and variant details."
)
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.id.asc()).all()
    return [p.to_dict() for p in products]


@router.get(
    "/admin/orders",
    summary="List all store orders",
    description="Returns customer orders with live fulfillment status and tracking."
)
def list_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [o.to_dict() for o in orders]
