"""
Meta WhatsApp Cloud API Endpoints & Multi-Tenant Sandbox Inbound Processor.
Handles Meta webhook verification handshakes, real-time message receipt parsing,
instant sandbox session binding (CONNECT <STORE_ID>), and AI reply dispatching.
"""

import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Request, Response, Query, BackgroundTasks, status
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.store import Store
from app.services.chat_service import ChatService
from app.services.cart_recovery import track_cart_engagement
from app.services.ai_support_service import ai_support_service
from app.services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory Sandbox Session Registry: { sender_phone_digits: store_id_str }
SANDBOX_BINDINGS: Dict[str, str] = {}


class SandboxSimulateRequest(BaseModel):
    sender_phone: str = Field(..., description="Customer / tester phone number")
    message_text: str = Field(..., description="Inbound text content or CONNECT command")
    store_id: Optional[str] = Field(None, description="Optional store ID context")


def _find_store_by_key_or_prefix(db, key: str) -> Optional[Store]:
    """Helper to locate a store by exact UUID, prefix UUID, or Name."""
    clean_key = key.strip().lower()
    all_stores = db.query(Store).filter(Store.is_active == True).all()
    for s in all_stores:
        s_id_str = str(s.id).lower()
        if (
            s_id_str == clean_key
            or s_id_str.startswith(clean_key)
            or s.name.strip().lower() == clean_key
        ):
            return s
    return None


async def handle_inbound_whatsapp_message(
    sender_phone: str,
    message_text: str,
    message_id: Optional[str] = None,
    store_id: Optional[Any] = None,
    system_prompt: Optional[str] = None,
    whatsapp_access_token: Optional[str] = None,
    phone_number_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Intelligent Inbound Message Processor:
    1. Checks for Sandbox commands: 'CONNECT <STORE_ID>' / 'TEST <STORE_ID>' / 'DISCONNECT' / 'RESET'.
    2. If bound to a sandbox store, routes queries and catalog grounding to that store tenant.
    3. Persists multi-turn conversation in ChatHistory partitioned by store_id.
    4. Generates AI support response and dispatches via WhatsApp Cloud API.
    """
    db = SessionLocal()
    clean_phone = "".join(c for c in str(sender_phone) if c.isdigit() or c == "+")
    clean_text = str(message_text or "").strip()
    upper_text = clean_text.upper()

    try:
        logger.info(
            f"📩 [WhatsApp Inbound] From: {clean_phone} | Initial Store: {store_id} | Body: '{clean_text}'"
        )

        # -------------------------------------------------------------
        # 1. Check for Instant Sandbox Session Binding Commands
        # -------------------------------------------------------------
        if upper_text.startswith("CONNECT ") or upper_text.startswith("TEST ") or upper_text.startswith("STORE "):
            parts = clean_text.split(None, 1)
            target_key = parts[1].strip() if len(parts) > 1 else ""

            target_store = _find_store_by_key_or_prefix(db, target_key) if target_key else None

            if target_store:
                SANDBOX_BINDINGS[clean_phone] = str(target_store.id)
                welcome_reply = (
                    f"🎉 *Connected to {target_store.name} Sandbox!*\n\n"
                    f"You are now chatting live with their autonomous WhatsApp AI shopping assistant.\n\n"
                    f"🛍️ Ask me about available products, sizes, prices, or order tracking!\n"
                    f"💡 Send *DISCONNECT* anytime to exit."
                )
                logger.info(
                    f"🔗 [Sandbox Bound] Phone {clean_phone} -> Store '{target_store.name}' ({target_store.id})"
                )

                await whatsapp_service.send_text_message(
                    to_phone_number=clean_phone,
                    message_text=welcome_reply,
                    token=target_store.whatsapp_access_token or whatsapp_access_token or settings.WHATSAPP_TOKEN,
                    phone_number_id=target_store.whatsapp_phone_number_id
                    if not target_store.whatsapp_phone_number_id.startswith("pending-")
                    else (phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID),
                )
                if message_id:
                    await whatsapp_service.mark_message_as_read(
                        message_id,
                        token=whatsapp_access_token or settings.WHATSAPP_TOKEN,
                        phone_number_id=phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID,
                    )
                return {
                    "status": "connected",
                    "reply": welcome_reply,
                    "store_id": str(target_store.id),
                    "store_name": target_store.name,
                }
            else:
                not_found_reply = (
                    f"⚠️ Store with ID or code '{target_key}' not found.\n\n"
                    f"Please verify your Store ID from the merchant dashboard (e.g. *CONNECT <store_id>*)."
                )
                await whatsapp_service.send_text_message(
                    to_phone_number=clean_phone,
                    message_text=not_found_reply,
                    token=whatsapp_access_token or settings.WHATSAPP_TOKEN,
                    phone_number_id=phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID,
                )
                return {
                    "status": "not_found",
                    "reply": not_found_reply,
                    "store_id": None,
                }

        elif upper_text in ("DISCONNECT", "RESET", "EXIT", "LEAVE"):
            SANDBOX_BINDINGS.pop(clean_phone, None)
            disconnect_reply = (
                "👋 *Disconnected from store sandbox.*\n\n"
                "Send *CONNECT <STORE_ID>* anytime to test another store."
            )
            logger.info(f"🔓 [Sandbox Unbound] Phone {clean_phone} reset.")

            await whatsapp_service.send_text_message(
                to_phone_number=clean_phone,
                message_text=disconnect_reply,
                token=whatsapp_access_token or settings.WHATSAPP_TOKEN,
                phone_number_id=phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID,
            )
            return {
                "status": "disconnected",
                "reply": disconnect_reply,
                "store_id": None,
            }

        # -------------------------------------------------------------
        # 2. Resolve Active Store Tenant Context (Sandbox vs Production)
        # -------------------------------------------------------------
        active_store_id = store_id
        active_system_prompt = system_prompt
        active_token = whatsapp_access_token
        active_phone_id = phone_number_id

        # Check if this phone has a bound sandbox store
        if clean_phone in SANDBOX_BINDINGS:
            bound_id = SANDBOX_BINDINGS[clean_phone]
            bound_store = _find_store_by_key_or_prefix(db, bound_id)
            if bound_store:
                active_store_id = bound_store.id
                active_system_prompt = bound_store.system_prompt
                if bound_store.whatsapp_access_token:
                    active_token = bound_store.whatsapp_access_token
                if bound_store.whatsapp_phone_number_id and not bound_store.whatsapp_phone_number_id.startswith("pending-"):
                    active_phone_id = bound_store.whatsapp_phone_number_id

        # Fallback to first active store if still unassigned
        if not active_store_id:
            default_store = db.query(Store).filter(Store.is_active == True).first()
            if default_store:
                active_store_id = default_store.id
                active_system_prompt = default_store.system_prompt

        session_id = ChatService.build_session_id(customer_phone=clean_phone, store_id=active_store_id)
        chat_service = ChatService(db)

        # 3. Load multi-turn conversation history
        history = chat_service.get_gemini_history(
            session_id=session_id,
            store_id=active_store_id,
            limit=10,
            max_inactivity_hours=4.0,
        )

        # 4. Track cart engagement
        cart = track_cart_engagement(
            sender_phone=clean_phone,
            message_text=clean_text,
            db=db,
        )

        # 5. Persist user message
        chat_service.add_message(
            session_id=session_id,
            role="user",
            content=clean_text,
            store_id=active_store_id,
        )

        # 6. Generate contextual AI support reply
        ai_reply = ai_support_service.generate_support_reply(
            customer_message=clean_text,
            cart_session=cart,
            customer_phone=clean_phone,
            chat_history=history,
            system_instruction=active_system_prompt,
            store_id=active_store_id,
            db=db,
        )
        logger.info(f"🤖 [WhatsApp AI Reply to {clean_phone} (Store: {active_store_id})]: '{ai_reply}'")

        # 7. Persist assistant reply
        chat_service.add_message(
            session_id=session_id,
            role="assistant",
            content=ai_reply,
            store_id=active_store_id,
        )

        # 8. Dispatch outbound WhatsApp message
        dispatch_result = await whatsapp_service.send_text_message(
            to_phone_number=clean_phone,
            message_text=ai_reply,
            token=active_token,
            phone_number_id=active_phone_id,
        )
        logger.info(f"📤 [WhatsApp Dispatch Result]: {dispatch_result}")

        # 9. Mark incoming message as read
        if message_id:
            await whatsapp_service.mark_message_as_read(
                message_id,
                token=active_token,
                phone_number_id=active_phone_id,
            )

        return {
            "status": "success",
            "reply": ai_reply,
            "session_id": session_id,
            "store_id": str(active_store_id) if active_store_id else None,
            "dispatch": dispatch_result,
        }

    except Exception as e:
        logger.error(f"❌ Error handling inbound WhatsApp message from {sender_phone}: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


# Backward compatibility alias
process_whatsapp_inbound_message = handle_inbound_whatsapp_message


# =====================================================================
# REST Endpoints
# =====================================================================

@router.get(
    "/whatsapp/sandbox-info",
    summary="Get WhatsApp Sandbox Platform Configuration",
    description="Returns platform shared sandbox phone number, connect command template, and active sessions count.",
)
def get_whatsapp_sandbox_info():
    """
    Returns platform sandbox connection parameters for frictionless instant testing.
    """
    raw_phone = settings.DEFAULT_WHATSAPP_PHONE or "15556494898"
    clean_phone = "".join(c for c in raw_phone if c.isdigit())
    return {
        "sandbox_phone_number": raw_phone,
        "clean_phone_number": clean_phone,
        "connect_command_template": "CONNECT {store_id}",
        "active_sessions_count": len(SANDBOX_BINDINGS),
        "is_configured": bool(settings.WHATSAPP_TOKEN and (settings.WHATSAPP_PHONE_NUMBER_ID or settings.META_PHONE_NUMBER_ID)),
    }


@router.post(
    "/whatsapp/sandbox/simulate-message",
    summary="Simulate WhatsApp Inbound Message for Sandbox Testing",
    description="Allows testing store binding, CONNECT commands, and conversational turns without Meta credentials.",
)
async def simulate_sandbox_message(payload: SandboxSimulateRequest):
    """
    Directly triggers handle_inbound_whatsapp_message for sandbox simulation.
    """
    res = await handle_inbound_whatsapp_message(
        sender_phone=payload.sender_phone,
        message_text=payload.message_text,
        store_id=payload.store_id,
    )
    return res


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
    """
    logger.info(f"🔍 Meta Webhook Verification Handshake Attempt - mode: {hub_mode}, verify_token: {hub_verify_token}")

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ Meta Webhook Verification Succeeded!")
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

    db = SessionLocal()
    try:
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

                # Delivery status updates
                statuses = value.get("statuses")
                if statuses and isinstance(statuses, list):
                    for st in statuses:
                        if isinstance(st, dict):
                            logger.info(
                                f"📋 [WhatsApp Status Receipt] ID: {st.get('id')} | Status: {st.get('status')} | Recipient: {st.get('recipient_id')}"
                            )
                    continue

                # Recipient phone_number_id
                metadata = value.get("metadata", {})
                phone_number_id = str(metadata.get("phone_number_id") or "").strip() if isinstance(metadata, dict) else ""

                # Query Store table
                matched_store: Optional[Store] = None
                if phone_number_id:
                    matched_store = db.query(Store).filter(
                        Store.whatsapp_phone_number_id == phone_number_id,
                        Store.is_active == True,
                    ).first()

                if not matched_store:
                    matched_store = db.query(Store).filter(Store.is_active == True).first()

                # Extract messages
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
                        logger.info(
                            f"📥 [WhatsApp Webhook Enqueue] Scheduling background task for {sender_phone} (Store: '{matched_store.name if matched_store else 'Sandbox'}')"
                        )
                        background_tasks.add_task(
                            handle_inbound_whatsapp_message,
                            sender_phone=sender_phone,
                            message_text=text_body,
                            message_id=message_id,
                            store_id=matched_store.id if matched_store else None,
                            system_prompt=matched_store.system_prompt if matched_store else None,
                            whatsapp_access_token=matched_store.whatsapp_access_token if matched_store else None,
                            phone_number_id=matched_store.whatsapp_phone_number_id if matched_store else None,
                        )

    finally:
        db.close()

    return {"status": "EVENT_RECEIVED"}
