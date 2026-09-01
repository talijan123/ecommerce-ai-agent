"""
OrderService: Handles database-backed queries for order status, tracking, and fulfillment.
"""

import re
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.order import Order


class OrderService:
    def __init__(self, db: Session):
        self.db = db

    def get_order_by_id_or_number(self, order_identifier: str) -> Dict[str, Any]:
        """
        Lookup order by order number (or ID) cleanly handling prefixes like '#'.
        """
        cleaned_id = re.sub(r"[^\w-]", "", order_identifier).lstrip("#").strip()

        order = self.db.query(Order).filter(
            or_(
                Order.order_number.ilike(cleaned_id),
                Order.order_number.ilike(f"#{cleaned_id}"),
                Order.order_number == cleaned_id,
            )
        ).first()

        if not order:
            return {
                "success": False,
                "error": f"Order #{cleaned_id} was not found in our database. Please verify the order number.",
                "suggested_action": "Ask the customer to double check their order confirmation email."
            }

        return {
            "success": True,
            "order_number": order.order_number,
            "customer_name": order.customer_name,
            "customer_email": order.customer_email,
            "status": order.status,
            "carrier": order.carrier,
            "tracking_number": order.tracking_number,
            "tracking_url": order.tracking_url,
            "estimated_delivery": order.estimated_delivery,
            "items": order.items,
            "total_amount": order.total_amount,
            "shipping_address": order.shipping_address,
            "cancellation_reason": order.cancellation_reason,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }

    def get_orders_by_customer_email(self, customer_email: str) -> List[Dict[str, Any]]:
        """
        Retrieve all recent orders associated with a customer email.
        """
        cleaned_email = customer_email.strip().lower()
        orders = self.db.query(Order).filter(
            Order.customer_email.ilike(cleaned_email)
        ).order_by(Order.created_at.desc()).all()

        return [o.to_dict() for o in orders]
