"""
Meta WhatsApp Cloud API Webhook Endpoints.
Handles verification handshake (GET) and real-time incoming customer messages (POST).
"""

import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Request, Response, Query, BackgroundTasks, status
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.agent import run_agent_turn
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def process_whatsapp_inbound_message(sender_phone: str, message_id: str, message_text: str):
    """
    Background worker that runs the autonomous AI agent loop against the database
    and sends the synthesized response back to the customer's WhatsApp number.
    """
    db = SessionLocal()
    try:
        session_id = f"wa_{sender_phone}"
        logger.info(f"📩 [WhatsApp Inbound] From: {sender_phone} | Query: '{message_text}' | Session: {session_id}")

        # Execute Autonomous AI Agent turn
        response_text, tools_invoked, success = run_agent_turn(
            db=db,
            session_id=session_id,
            user_message=message_text,
        )

        logger.info(f"🤖 [WhatsApp AI Response]: '{response_text[:100]}...' | Tools Invoked: {[t['tool_name'] for t in tools_invoked]}")

        # Send reply back to customer on WhatsApp
        await whatsapp_service.send_text_message(
            to_phone_number=sender_phone,
            message_text=response_text,
        )

        # Mark incoming message as read
        if message_id:
            await whatsapp_service.mark_message_as_read(message_id)

    except Exception as e:
        logger.error(f"❌ Error processing WhatsApp message: {str(e)}", exc_info=True)
    finally:
        db.close()


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
    description="Ingests incoming customer WhatsApp messages, routes them to the AI agent, and replies via Meta Graph API."
)
async def receive_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receives real-time events from Meta WhatsApp Cloud API.
    Acknowledge with HTTP 200 immediately and process the AI turn in the background.
    """
    try:
        payload: Dict[str, Any] = await request.json()
    except Exception:
        # Return 200 even on unparseable payloads so Meta does not disable the webhook
        return {"status": "ignored", "reason": "invalid_json"}

    # Validate payload structure
    entry_list = payload.get("entry", [])
    if not entry_list:
        return {"status": "ok"}

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
                        # Dispatch agent processing to BackgroundTasks
                        background_tasks.add_task(
                            process_whatsapp_inbound_message,
                            sender_phone=sender_phone,
                            message_id=message_id,
                            message_text=text_body,
                        )

    # Immediately acknowledge Meta with 200 OK (< 3 second SLA requirement)
    return {"status": "ok"}
