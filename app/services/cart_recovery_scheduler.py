"""
Cart Recovery Scheduler and Background Worker Service.
Scans for abandoned carts older than threshold (default 30 mins) with status 'pending'
and dispatches personalized WhatsApp recovery offers with direct checkout links.
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.database import SessionLocal
from app.models.cart import CartSession
from app.models.store import Store
from app.services.whatsapp_service import whatsapp_service
from app.services.cart_recovery import (
    cart_recovery_service,
    format_items_summary,
    build_recovery_message,
)

logger = logging.getLogger(__name__)


class CartRecoveryScheduler:
    """Automated Recovery Dispatcher for abandoned shopping carts."""

    @classmethod
    def run_recovery_job(
        cls,
        threshold_minutes: int = 30,
        store_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Scans for abandoned carts exceeding threshold_minutes without recovery dispatch.
        Dispatches recovery WhatsApp message and updates status to 'dispatched'.
        """
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            cutoff_utc = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
            cutoff_naive = cutoff_utc.replace(tzinfo=None)

            query = db.query(CartSession).filter(
                CartSession.is_recovered == False,
                CartSession.recovery_sent == False,
                CartSession.customer_phone.isnot(None),
                CartSession.customer_phone != "",
                or_(
                    CartSession.updated_at <= cutoff_utc,
                    and_(CartSession.updated_at.is_(None), CartSession.created_at <= cutoff_utc),
                    CartSession.updated_at <= cutoff_naive,
                    and_(CartSession.updated_at.is_(None), CartSession.created_at <= cutoff_naive),
                    and_(CartSession.abandoned_at.isnot(None), CartSession.abandoned_at <= cutoff_utc),
                ),
            )

            if store_id:
                try:
                    store_uuid = uuid.UUID(str(store_id))
                    query = query.filter(CartSession.store_id == store_uuid)
                except (ValueError, AttributeError):
                    pass

            eligible_carts = query.all()
            logger.info(f"🛒 [CartRecoveryScheduler] Found {len(eligible_carts)} eligible abandoned cart(s).")

            dispatched = []
            skipped = []

            for cart in eligible_carts:
                # Retrieve store tenant credentials if available
                store = None
                if cart.store_id:
                    store = db.query(Store).filter(Store.id == cart.store_id).first()

                token = store.whatsapp_access_token if store else None
                phone_id = store.whatsapp_phone_number_id if store else None

                customer_name = cart.customer_name or "Valued Customer"
                items_summary = format_items_summary(cart.abandoned_items or [])
                discount_code = cart.discount_code or "RECOVER10"
                discount_pct = cart.discount_percentage or 10
                checkout_link = cart.checkout_url or f"https://ecommerce-store.com/checkout?session={cart.session_id}&discount={discount_code}"

                msg_text = build_recovery_message(
                    customer_name=customer_name,
                    items_summary=items_summary,
                    discount_code=discount_code,
                    discount_percentage=discount_pct,
                    checkout_url=checkout_link,
                )

                dispatch_res = whatsapp_service.send_text_message_sync(
                    to_phone_number=cart.customer_phone,
                    message_text=msg_text,
                    token=token,
                    phone_number_id=phone_id,
                )

                cart.recovery_sent = True
                cart.recovery_sent_at = datetime.now(timezone.utc)
                cart.status = "dispatched"
                cart.updated_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(cart)

                outcome = {
                    "session_id": cart.session_id,
                    "store_id": str(cart.store_id) if cart.store_id else None,
                    "customer_name": customer_name,
                    "customer_phone": cart.customer_phone,
                    "discount_code": discount_code,
                    "status": "dispatched",
                    "dispatch_result": dispatch_res,
                }
                dispatched.append(outcome)

            return {
                "status": "completed",
                "threshold_minutes": threshold_minutes,
                "total_evaluated": len(eligible_carts),
                "total_dispatched": len(dispatched),
                "dispatched_sessions": dispatched,
                "skipped_sessions": skipped,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        except Exception as e:
            logger.error(f"❌ [CartRecoveryScheduler] Error running recovery job: {e}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        finally:
            if should_close:
                db.close()
