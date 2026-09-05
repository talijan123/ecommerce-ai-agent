"""
SQLAlchemy Model for SaaS Multi-Tenant Stores.
Stores merchant credentials, WhatsApp phone number IDs, and custom bot instructions.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Text, Boolean, DateTime, Uuid, ForeignKey
from app.core.database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    owner_email = Column(String(255), nullable=False, index=True)
    whatsapp_phone_number_id = Column(String(100), unique=True, index=True, nullable=False)
    whatsapp_access_token = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
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
            "owner_id": str(self.owner_id) if self.owner_id else None,
            "name": self.name,
            "owner_email": self.owner_email,
            "whatsapp_phone_number_id": self.whatsapp_phone_number_id,
            "whatsapp_access_token": self.whatsapp_access_token,
            "system_prompt": self.system_prompt,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": (self.updated_at or self.created_at).isoformat() if (self.updated_at or self.created_at) else None,
        }
