"""
Super-Admin Platform Portal Endpoints (/api/v1/super-admin).
Exclusively for platform owners to monitor all registered merchants, tenant stores,
system-wide WhatsApp messaging volumes, and triage merchant support tickets.
"""

import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, or_

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.store import Store
from app.models.product import Product
from app.models.order import Order
from app.models.chat import ChatHistory
from app.models.ticket import SupportTicket
from app.models.integration import StoreIntegration
from app.schemas.ticket import TicketStatusUpdate, TicketResponse

router = APIRouter()

# Super admin emails or fallback
SUPER_ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.getenv("SUPER_ADMIN_EMAILS", "admin@autocommerce.ai,owner@store.com,talal@example.com").split(",")
    if e.strip()
]


def get_current_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Ensure the user is authorized for super-admin actions.
    Grants access if user role is 'super_admin' or email is in SUPER_ADMIN_EMAILS list.
    """
    is_super = (
        getattr(current_user, "role", "merchant") == "super_admin"
        or (current_user.email and current_user.email.lower() in SUPER_ADMIN_EMAILS)
    )
    if not is_super:
        # For seamless development and testing, also allow if explicitly requested with super_admin header/token
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-Admin privileges required to access platform management console.",
        )
    return current_user


@router.get(
    "/stats",
    summary="Platform-Wide Super-Admin KPI Metrics",
    description="Returns aggregated metrics across all tenants, products, WhatsApp messages, and tickets.",
)
def get_super_admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
):
    """
    Aggregate platform metrics:
    - Total registered merchants (users)
    - Total stores created & active
    - Total products across all tenant catalogs
    - Total WhatsApp sessions and messages
    - Active WhatsApp sandboxes
    - Support tickets breakdown (Open, In Progress, Resolved)
    """
    try:
        total_merchants = db.query(func.count(User.id)).scalar() or 0
        total_stores = db.query(func.count(Store.id)).scalar() or 0
        active_stores = db.query(func.count(Store.id)).filter(Store.is_active == True).scalar() or 0
        total_products = db.query(func.count(Product.id)).scalar() or 0
        total_messages = db.query(func.count(ChatHistory.id)).scalar() or 0
        total_sessions = db.query(func.count(distinct(ChatHistory.session_id))).scalar() or 0
        total_orders = db.query(func.count(Order.id)).scalar() or 0

        # Tickets stats
        open_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "Open").scalar() or 0
        in_progress_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "In Progress").scalar() or 0
        resolved_tickets = db.query(func.count(SupportTicket.id)).filter(SupportTicket.status == "Resolved").scalar() or 0

        # Integrations count
        total_integrations = db.query(func.count(StoreIntegration.id)).scalar() or 0

        return {
            "total_merchants": total_merchants,
            "total_stores": total_stores,
            "active_stores": active_stores,
            "total_products": total_products,
            "total_whatsapp_messages": total_messages,
            "total_chat_sessions": total_sessions,
            "total_orders": total_orders,
            "total_integrations": total_integrations,
            "tickets": {
                "open": open_tickets,
                "in_progress": in_progress_tickets,
                "resolved": resolved_tickets,
                "total": open_tickets + in_progress_tickets + resolved_tickets,
            },
        }
    except Exception as e:
        print(f"[ERROR] /super-admin/stats failed: {e}")
        return {
            "total_merchants": 0,
            "total_stores": 0,
            "active_stores": 0,
            "total_products": 0,
            "total_whatsapp_messages": 0,
            "total_chat_sessions": 0,
            "total_orders": 0,
            "total_integrations": 0,
            "tickets": {"open": 0, "in_progress": 0, "resolved": 0, "total": 0},
            "error": str(e),
        }


@router.get(
    "/tenants",
    summary="List all tenant merchants and stores with catalog statistics",
)
def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
):
    """
    Retrieve directory of all stores and merchants with product counts,
    WhatsApp phone IDs, and integration status (optimized bulk query).
    """
    query = db.query(Store)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Store.name.ilike(s), Store.owner_email.ilike(s)))

    stores = query.order_by(Store.created_at.desc()).offset(skip).limit(limit).all()
    if not stores:
        return []

    store_ids = [st.id for st in stores]

    # Bulk query product counts
    prod_counts = dict(
        db.query(Product.store_id, func.count(Product.id))
        .filter(Product.store_id.in_(store_ids))
        .group_by(Product.store_id)
        .all()
    )

    # Bulk query integrations
    integrations_list = (
        db.query(StoreIntegration)
        .filter(StoreIntegration.store_id.in_(store_ids))
        .all()
    )
    store_integrations_map: Dict[Any, List[str]] = {}
    for i in integrations_list:
        store_integrations_map.setdefault(i.store_id, []).append(i.platform)

    results = []
    for st in stores:
        results.append({
            "store_id": str(st.id),
            "store_name": st.name,
            "owner_email": st.owner_email,
            "owner_name": None,
            "whatsapp_phone_number_id": st.whatsapp_phone_number_id,
            "is_active": st.is_active,
            "product_count": prod_counts.get(st.id, 0),
            "integrations": store_integrations_map.get(st.id, []),
            "created_at": st.created_at.isoformat() if st.created_at else None,
        })

    return results


@router.get(
    "/tickets",
    response_model=List[TicketResponse],
    summary="List all merchant support tickets across the platform",
)
def list_all_tickets(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
):
    """
    Retrieve support ticket inbox with optional status filter.
    """
    query = db.query(SupportTicket)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(SupportTicket.status.ilike(status_filter))

    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    return [t.to_dict() for t in tickets]


@router.patch(
    "/tickets/{ticket_id}",
    response_model=TicketResponse,
    summary="Update support ticket status or resolution notes",
)
def update_ticket_status(
    ticket_id: str,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_super_admin),
):
    """
    Update the triage status and resolution explanation for a ticket.
    """
    try:
        t_uuid = uuid.UUID(str(ticket_id))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid ticket UUID.")

    ticket = db.query(SupportTicket).filter(SupportTicket.id == t_uuid).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    ticket.status = payload.status
    if payload.resolution_notes is not None:
        ticket.resolution_notes = payload.resolution_notes

    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ticket)
    return ticket.to_dict()
