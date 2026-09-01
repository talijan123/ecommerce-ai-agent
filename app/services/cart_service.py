"""
CartService: Handles abandoned cart session lookups and promotional discount issuance.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.cart import CartSession


class CartService:
    def __init__(self, db: Session):
        self.db = db

    def apply_cart_recovery_discount(self, customer_email: str) -> Dict[str, Any]:
        """
        Check for an abandoned shopping cart session by customer email and return discount details.
        """
        cleaned_email = customer_email.strip().lower()

        session = self.db.query(CartSession).filter(
            CartSession.customer_email.ilike(cleaned_email)
        ).first()

        if not session:
            return {
                "success": False,
                "customer_email": customer_email,
                "error": f"No active or abandoned cart session found for '{customer_email}'.",
                "suggested_action": "Invite customer to add items to their cart on the website."
            }

        if not session.discount_eligible:
            return {
                "success": False,
                "customer_email": session.customer_email,
                "session_id": session.session_id,
                "reason": session.ineligibility_reason or "Customer has already redeemed a recovery discount recently."
            }

        return {
            "success": True,
            "customer_email": session.customer_email,
            "session_id": session.session_id,
            "abandoned_items": session.abandoned_items,
            "discount_code": session.discount_code or "SAVE10",
            "discount_percentage": session.discount_percentage,
            "expires_in_hours": session.expires_in_hours,
            "message": f"Cart recovery discount of {session.discount_percentage}% applied! Use code '{session.discount_code or 'SAVE10'}' at checkout."
        }
