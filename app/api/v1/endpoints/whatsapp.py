import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, Response, Query, BackgroundTasks, status
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.cart_recovery import track_cart_engagement
from app.services.ai_support_service import ai_support_service
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def handle_inbound_whatsapp_message(
    sender_phone: str,
    message_text: str,
    message_id: Optional[str] = None,
):
    """
    Intelligent Inbound Message Processor:
    1. Tracks and updates CartSession engagement in database (status='engaged', response timestamp).
    2. Generates a contextual AI customer support reply via Gemini AI.
    3. Dispatches reply to customer's WhatsApp number via Meta Cloud API.
    4. Marks incoming message as read.
    """
    db = SessionLocal()
    try:
        logger.info(f"📩 [WhatsApp Inbound] Received message from: {sender_phone} | Query: '{message_text}'")

        # 1. Update CartSession engagement in DB
        cart = track_cart_engagement(
            sender_phone=sender_phone,
            message_text=message_text,
            db=db,
        )

        # 2. Generate contextual AI support reply using Gemini
        ai_reply = ai_support_service.generate_support_reply(
            customer_message=message_text,
            cart_session=cart,
            customer_phone=sender_phone,
        )
        logger.info(f"🤖 [WhatsApp AI Reply to {sender_phone}]: '{ai_reply}'")

        # 3. Dispatch outbound reply message to WhatsApp
        dispatch_result = await whatsapp_service.send_text_message(
            to_phone_number=sender_phone,
            message_text=ai_reply,
        )
        logger.info(f"📤 [WhatsApp Outbound Dispatch Result]: {dispatch_result}")

        # 4. Mark incoming message as read
        if message_id:
            await whatsapp_service.mark_message_as_read(message_id)

    except Exception as e:
        logger.error(f"❌ Error handling inbound WhatsApp message from {sender_phone}: {e}", exc_info=True)
    finally:
        db.close()


# Alias for backward compatibility with existing tests
process_whatsapp_inbound_message = handle_inbound_whatsapp_message


@router.get(
    "/webhooks/whatsapp",
    summary="Meta Webhook Verification Handshake",
    description="Validates the hub.verify_token and returns hub.challenge to confirm webhook ownership with Meta."
)
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Handles Meta's Webhook Subscription Verification Handshake.
    """
    logger.info(f"🔍 Meta Webhook Verification Attempt - mode: {hub_mode}, verify_token: {hub_verify_token}")

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ Meta Webhook Verification Succeeded!")
        # Must return the raw hub.challenge string with 200 OK
        return Response(content=str(hub_challenge), media_type="text/plain", status_code=status.HTTP_200_OK)

    logger.warning("❌ Meta Webhook Verification Failed: Invalid verify token or mode.")
    return Response(content="Forbidden: Verification Token Mismatch", status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    "/webhooks/whatsapp",
    summary="Receive WhatsApp Webhook Events",
    description="Ingests incoming customer WhatsApp messages, tracks engagement, and triggers Gemini AI contextual replies."
)
async def receive_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receives real-time events from Meta WhatsApp Cloud API.
    Acknowledge with HTTP 200 immediately and process the engagement tracking and AI reply in the background.
    """
    try:
        payload: Dict[str, Any] = await request.json()
    except Exception:
        # Return 200 even on unparseable payloads so Meta does not disable the webhook
        return {"status": "EVENT_RECEIVED", "reason": "invalid_json"}

    # Validate payload structure
    entry_list = payload.get("entry", [])
    if not entry_list:
        return {"status": "EVENT_RECEIVED"}

    for entry in entry_list:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            
            # Check for incoming customer messages
            messages = value.get("messages", [])
            if not messages:
                # Could be a status receipt (sent/delivered/read) - acknowledge and ignore
                continue

            for msg in messages:
                # Process text messages
                msg_type = msg.get("type")
                sender_phone = msg.get("from")
                message_id = msg.get("id")

                if msg_type == "text" and sender_phone:
                    text_body = msg.get("text", {}).get("body", "").strip()
                    if text_body:
                        # Queue background task for engagement tracking and Gemini reply
                        background_tasks.add_task(
                            handle_inbound_whatsapp_message,
                            sender_phone=sender_phone,
                            message_text=text_body,
                            message_id=message_id,
                        )

    # Immediately acknowledge Meta with 200 OK (< 3 second SLA requirement)
    return {"status": "EVENT_RECEIVED"}

