"""
SQLAlchemy Model for Merchant Users & SaaS Authentication.
Supports email verification, secure bcrypt password hashing, and store ownership.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Boolean, DateTime, Uuid
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize user object safe for JSON responses (omitting password hash)."""
        return {
            "id": str(self.id) if self.id else None,
            "email": self.email,
            "full_name": self.full_name,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": (self.updated_at or self.created_at).isoformat() if (self.updated_at or self.created_at) else None,
        }
