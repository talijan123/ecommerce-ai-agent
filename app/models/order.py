"""
SQLAlchemy Model for Orders and Shipping/Fulfillment Details.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(150), index=True, nullable=False)
    status = Column(String(50), index=True, nullable=False)  # "Shipped", "Processing", "Delivered", "Cancelled"
    carrier = Column(String(100), nullable=True)
    tracking_number = Column(String(100), nullable=True)
    tracking_url = Column(String(255), nullable=True)
    estimated_delivery = Column(String(100), nullable=True)
    items = Column(JSON, default=list, nullable=False)
    total_amount = Column(Float, nullable=False)
    shipping_address = Column(Text, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "order_number": self.order_number,
            "customer_name": self.customer_name,
            "customer_email": self.customer_email,
            "status": self.status,
            "carrier": self.carrier,
            "tracking_number": self.tracking_number,
            "tracking_url": self.tracking_url,
            "estimated_delivery": self.estimated_delivery,
            "items": self.items,
            "total_amount": self.total_amount,
            "shipping_address": self.shipping_address,
            "cancellation_reason": self.cancellation_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
