"""
SQLAlchemy Model for Abandoned Cart Sessions and Recovery Discounts.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime
from app.core.database import Base


class CartSession(Base):
    __tablename__ = "cart_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    customer_email = Column(String(150), index=True, nullable=False)
    customer_name = Column(String(150), nullable=True, default="Valued Customer")
    customer_phone = Column(String(50), index=True, nullable=True)
    abandoned_items = Column(JSON, default=list, nullable=False)
    discount_eligible = Column(Boolean, default=True, nullable=False)
    discount_code = Column(String(50), nullable=True, default="RECOVER10")
    discount_percentage = Column(Integer, default=10, nullable=False)
    expires_in_hours = Column(Integer, default=24, nullable=False)
    ineligibility_reason = Column(String(255), nullable=True)
    is_recovered = Column(Boolean, default=False, nullable=False)
    recovery_sent = Column(Boolean, default=False, nullable=False)
    recovery_sent_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="pending", nullable=True)
    customer_response_at = Column(DateTime, nullable=True)
    last_customer_message = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "customer_email": self.customer_email,
            "customer_name": self.customer_name or "Valued Customer",
            "customer_phone": self.customer_phone,
            "abandoned_items": self.abandoned_items,
            "discount_eligible": self.discount_eligible,
            "discount_code": self.discount_code,
            "discount_percentage": self.discount_percentage,
            "expires_in_hours": self.expires_in_hours,
            "ineligibility_reason": self.ineligibility_reason,
            "is_recovered": self.is_recovered,
            "recovery_sent": self.recovery_sent,
            "recovery_sent_at": self.recovery_sent_at.isoformat() if self.recovery_sent_at else None,
            "status": self.status or ("recovered" if self.is_recovered else ("sent" if self.recovery_sent else "pending")),
            "customer_response_at": self.customer_response_at.isoformat() if self.customer_response_at else None,
            "last_customer_message": self.last_customer_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": (self.updated_at or self.created_at).isoformat() if (self.updated_at or self.created_at) else None,
        }


