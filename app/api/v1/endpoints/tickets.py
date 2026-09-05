"""
Merchant Support Tickets Endpoints (/api/v1/support/tickets).
Allows store owners to submit issues, bug reports, and assistance requests.
"""

import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.store import Store
from app.models.ticket import SupportTicket
from app.schemas.ticket import TicketCreate, TicketResponse

router = APIRouter()


@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new merchant support ticket",
)
def create_support_ticket(
    payload: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new support ticket submitted by the merchant.
    """
    parsed_store_id = None
    if payload.store_id:
        try:
            parsed_store_id = uuid.UUID(str(payload.store_id))
        except (ValueError, AttributeError):
            pass

    ticket = SupportTicket(
        user_id=current_user.id,
        store_id=parsed_store_id,
        user_email=current_user.email,
        subject=payload.subject.strip(),
        description=payload.description.strip(),
        category=payload.category or "general",
        priority=payload.priority or "normal",
        status="Open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket.to_dict()


@router.get(
    "",
    response_model=List[TicketResponse],
    summary="List support tickets created by the authenticated merchant",
)
def list_my_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all tickets submitted by the currently logged-in user.
    """
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [t.to_dict() for t in tickets]
