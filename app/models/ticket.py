"""
SQLAlchemy Model for Merchant Support & Bug Tracking Tickets.
Enables merchants to submit issues and super-admins to triage and resolve them.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Text, DateTime, Uuid, ForeignKey
from app.core.database import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    store_id = Column(Uuid(as_uuid=True), ForeignKey("stores.id"), nullable=True, index=True)
    user_email = Column(String(255), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), default="general", nullable=False)  # 'general', 'whatsapp', 'catalog', 'billing', 'bug'
    priority = Column(String(20), default="normal", nullable=False)   # 'low', 'normal', 'high', 'urgent'
    status = Column(String(30), default="Open", nullable=False)        # 'Open', 'In Progress', 'Resolved', 'Closed'
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id) if self.id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "store_id": str(self.store_id) if self.store_id else None,
            "user_email": self.user_email,
            "subject": self.subject,
            "description": self.description,
            "category": self.category,
            "priority": self.priority,
            "status": self.status,
            "resolution_notes": self.resolution_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": (self.updated_at or self.created_at).isoformat() if (self.updated_at or self.created_at) else None,
        }
