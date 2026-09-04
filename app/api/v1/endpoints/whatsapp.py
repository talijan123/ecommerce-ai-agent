import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, Response, Query, BackgroundTasks, status
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.chat_service import ChatService
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
    Intelligent Inbound Message Processor (Executed asynchronously via BackgroundTasks):
    1. Tracks and updates CartSession engagement in database (status='engaged', response timestamp).
    2. Loads multi-turn conversation memory (last 6-10 messages, < 4h active window) for this WhatsApp user.
    3. Persists incoming user message in ChatHistory.
    4. Generates contextual AI customer support reply via Gemini AI with multi-turn history & Supabase tools.
    5. Persists assistant's generated response in ChatHistory.
    6. Dispatches reply to customer's WhatsApp number via Meta Cloud API.
    7. Marks incoming message as read on WhatsApp.
    Guarantees database session cleanup via a finally block.
    """
    db = SessionLocal()
    try:
        logger.info(f"📩 [WhatsApp Inbound Worker] Message from: {sender_phone} | Body: '{message_text}'")
        session_id = f"wa_{sender_phone}"
        chat_service = ChatService(db)

        # 1. Fetch multi-turn conversation history for this user (< 4h inactivity, max 10 turns)
        history = chat_service.get_gemini_history(session_id=session_id, limit=10, max_inactivity_hours=4.0)

        # 2. Update CartSession engagement in DB
        cart = track_cart_engagement(
            sender_phone=sender_phone,
            message_text=message_text,
            db=db,
        )

        # 3. Store incoming user message in database
        chat_service.add_message(session_id=session_id, role="user", content=message_text)

        # 4. Generate contextual AI support reply using Gemini AI with multi-turn history
        ai_reply = ai_support_service.generate_support_reply(
            customer_message=message_text,
            cart_session=cart,
            customer_phone=sender_phone,
            chat_history=history,
            db=db,
        )
        logger.info(f"🤖 [WhatsApp AI Reply to {sender_phone}]: '{ai_reply}'")

        # 5. Store assistant reply in database
        chat_service.add_message(session_id=session_id, role="assistant", content=ai_reply)

        # 6. Dispatch outbound reply message to WhatsApp
        dispatch_result = await whatsapp_service.send_text_message(
            to_phone_number=sender_phone,
            message_text=ai_reply,
        )
        logger.info(f"📤 [WhatsApp Outbound Dispatch Result]: {dispatch_result}")

        # 7. Mark incoming message as read
        if message_id:
            await whatsapp_service.mark_message_as_read(message_id)

    except Exception as e:
        logger.error(f"❌ Error handling inbound WhatsApp message from {sender_phone}: {e}", exc_info=True)
    finally:
        db.close()


# Backward compatibility alias for tests and external callers
process_whatsapp_inbound_message = handle_inbound_whatsapp_message


@router.get(
    "/webhooks/whatsapp",
    summary="Meta Webhook Verification Handshake",
    description="Validates the hub.verify_token against settings and returns raw hub.challenge to confirm webhook ownership with Meta.",
)
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Handles Meta's Webhook Subscription Verification Handshake (GET).
    Meta sends:
      - hub.mode = 'subscribe'
      - hub.verify_token = <your_configured_verify_token>
      - hub.challenge = <random_integer_or_string>
    Must return 200 OK with the exact hub.challenge in the response body.
    """
    logger.info(f"🔍 Meta Webhook Verification Handshake Attempt - mode: {hub_mode}, verify_token: {hub_verify_token}")

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ Meta Webhook Verification Succeeded!")
        # Must return the raw hub.challenge string with 200 OK
        return Response(content=str(hub_challenge or ""), media_type="text/plain", status_code=status.HTTP_200_OK)

    logger.warning("❌ Meta Webhook Verification Failed: Invalid verify token or subscription mode.")
    return Response(content="Forbidden: Verification Token Mismatch", media_type="text/plain", status_code=status.HTTP_403_FORBIDDEN)


@router.post(
    "/webhooks/whatsapp",
    summary="Receive WhatsApp Webhook Events",
    description="Ingests incoming customer WhatsApp messages, handles status receipts, and schedules background AI support processing.",
)
async def receive_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receives real-time webhook events from Meta WhatsApp Cloud API (POST).
    Always responds with HTTP 200 immediately (< 3s SLA) and delegates message processing
    to FastAPI BackgroundTasks.
    """
    try:
        payload: Dict[str, Any] = await request.json()
    except Exception as err:
        logger.warning(f"⚠️ Received invalid or empty JSON in WhatsApp webhook: {err}")
        return {"status": "EVENT_RECEIVED", "reason": "invalid_json"}

    if not isinstance(payload, dict):
        return {"status": "EVENT_RECEIVED"}

    entry_list: List[Dict[str, Any]] = payload.get("entry", [])
    if not isinstance(entry_list, list):
        return {"status": "EVENT_RECEIVED"}

    for entry in entry_list:
        if not isinstance(entry, dict):
            continue

        changes = entry.get("changes", [])
        if not isinstance(changes, list):
            continue

        for change in changes:
            if not isinstance(change, dict):
                continue

            value = change.get("value", {})
            if not isinstance(value, dict):
                continue

            # 1. Handle delivery status updates (sent / delivered / read / failed) gracefully
            statuses = value.get("statuses")
            if statuses and isinstance(statuses, list):
                for st in statuses:
                    if isinstance(st, dict):
                        logger.info(
                            f"📋 [WhatsApp Status Receipt] ID: {st.get('id')} | Status: {st.get('status')} | Recipient: {st.get('recipient_id')}"
                        )
                continue

            # 2. Extract incoming customer messages
            messages = value.get("messages")
            if not messages or not isinstance(messages, list):
                continue

            for msg in messages:
                if not isinstance(msg, dict):
                    continue

                sender_phone = msg.get("from")
                message_id = msg.get("id")
                msg_type = msg.get("type", "text")

                text_body = ""
                if msg_type == "text":
                    text_obj = msg.get("text")
                    if isinstance(text_obj, dict):
                        text_body = text_obj.get("body", "").strip()
                    elif isinstance(text_obj, str):
                        text_body = text_obj.strip()
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    if isinstance(interactive, dict):
                        btn_reply = interactive.get("button_reply", {})
                        list_reply = interactive.get("list_reply", {})
                        if isinstance(btn_reply, dict) and btn_reply.get("title"):
                            text_body = btn_reply.get("title", "").strip()
                        elif isinstance(list_reply, dict) and list_reply.get("title"):
                            text_body = list_reply.get("title", "").strip()
                elif msg_type in ("button", "response"):
                    button_obj = msg.get("button", {})
                    if isinstance(button_obj, dict):
                        text_body = button_obj.get("text", "").strip()

                if sender_phone and text_body:
                    logger.info(f"📥 [WhatsApp Webhook Enqueue] Scheduling background task for {sender_phone}")
                    # Enqueue background task so Meta receives immediate HTTP 200
                    background_tasks.add_task(
                        handle_inbound_whatsapp_message,
                        sender_phone=sender_phone,
                        message_text=text_body,
                        message_id=message_id,
                    )

    # Immediately acknowledge Meta with 200 OK (< 3 second SLA requirement)
    return {"status": "EVENT_RECEIVED"}
