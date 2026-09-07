"""
Autonomous E-Commerce AI Agent Core Execution Loop.
Grounded in database services, persistent session memory, and OpenAI Tool Calling.
"""

import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from openai import OpenAI

from app.core.config import settings
from app.services.chat_service import ChatService
from app.tools.schemas import OPENAI_TOOLS, execute_tool_with_db

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert, autonomous customer support AI assistant for an e-commerce store.

### CORE DIRECTIVES & BEHAVIORAL RULES:
1. **PUNCHY & CONCISE FORMAT**: Keep replies concise, helpful, and professional (1 to 3 short sentences maximum). Ideal for mobile web and chat reading. Never over-explain, lecture, or dump unnecessary text.
2. **STRICT LANGUAGE & SCRIPT GROUNDING**:
   - **Language Mirroring**: You MUST strictly reply in the EXACT language the customer speaks.
   - If customer writes in English -> Reply ONLY in clean, fluent English.
   - If customer writes in Roman Urdu (e.g. "Mera order 1043 kab deliver hoga?", "Ye shirt size M me available hai?", "Price kya hai?") -> Reply in clean, natural Roman Urdu (e.g. "Aapka order #1043 processing me hai aur 2-4 din mein deliver ho jayega.").
   - **STRICTLY FORBIDDEN**: NEVER use Devanagari or Hindi script (e.g., absolutely forbid words like 'कृपया', 'नमस्ते', 'धन्यवाद', etc.). All South Asian context MUST be written strictly in Roman Urdu using Latin alphabet characters only.
3. **NO HALLUCINATIONS & TOOL USAGE**:
   - Never guess, assume, or fabricate order numbers, shipping details, tracking links, inventory stock levels, or discounts.
   - You MUST ALWAYS call the appropriate tool first (track_order, check_product_stock, etc.) to retrieve verified real-time data from the store database before answering.
4. **INVENTORY & OUT-OF-STOCK HANDLING**:
   - If a customer asks for a product or size that is out of stock (stock_count = 0 or in_stock = false), state clearly that the item is currently out of stock.
   - Proactively suggest any other available sizes that are in stock for that product, or suggest related products.
5. **HUMAN ESCALATION**:
   - If the customer asks to speak to a human, agent, representative, or manager (e.g., "I want to talk to a human", "manager se baat karni hai"), politely assure them that their request has been escalated to a human support agent/manager who will assist them shortly.
"""


def get_openai_client() -> Optional[OpenAI]:
    """Initialize OpenAI client configured for Groq or OpenAI."""
    api_key = settings.GROQ_API_KEY or settings.OPENAI_API_KEY
    if not api_key or "your_" in api_key:
        return None

    return OpenAI(
        api_key=api_key,
        base_url=settings.LLM_BASE_URL or "https://api.groq.com/openai/v1"
    )


def run_agent_turn(
    db: Session,
    session_id: str,
    user_message: str,
    customer_email: Optional[str] = None,
    store_id: Optional[Any] = None,
    max_turns: int = 5,
) -> Tuple[str, List[Dict[str, Any]], bool]:
    """
    Execute a full multi-turn tool interaction loop for a user query.

    Args:
        db: Active SQLAlchemy database session.
        session_id: Conversation session identifier.
        user_message: Natural language customer query.
        customer_email: Optional customer email for session context.
        store_id: Optional tenant store UUID for multi-tenant data isolation.
        max_turns: Maximum tool execution turns to prevent infinite loops.

    Returns:
        Tuple of (response_text, list_of_tool_invocations, success_flag)
    """
    import uuid as _uuid_mod
    from app.services.ai_support_service import sanitize_ai_response
    from app.models.store import Store

    parsed_store_uuid = None
    if store_id:
        try:
            parsed_store_uuid = _uuid_mod.UUID(str(store_id).strip())
        except (ValueError, AttributeError):
            parsed_store_uuid = None

    if parsed_store_uuid is None:
        try:
            first_store = db.query(Store).filter(Store.is_active == True).first()
            if first_store:
                parsed_store_uuid = first_store.id
        except Exception:
            pass

    chat_service = ChatService(db)
    client = get_openai_client()

    # Check escalation intent
    is_escalate = chat_service.is_escalation_intent(user_message) or chat_service.is_session_needs_human(session_id, store_id=parsed_store_uuid)
    if is_escalate:
        chat_service.mark_session_needs_human(session_id, store_id=parsed_store_uuid)

    # If email is provided in the request, append context if not already mentioned
    full_user_input = user_message
    if customer_email and "@" in customer_email and customer_email.lower() not in user_message.lower():
        full_user_input = f"{user_message} (My email is: {customer_email})"

    # Fetch prior conversation history from database
    prior_messages = chat_service.get_history(session_id, store_id=parsed_store_uuid, limit=12)

    # Persist the new user query
    chat_service.add_message(
        session_id=session_id,
        role="user",
        content=full_user_input,
        store_id=parsed_store_uuid,
        needs_human=True if is_escalate else None,
    )

    # Build prompt messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(prior_messages)
    messages.append({"role": "user", "content": full_user_input})

    tools_invoked_log: List[Dict[str, Any]] = []

    if client is None:
        # Fallback simulation when no live Groq or OpenAI key is configured
        if is_escalate:
            fallback_msg = "I have flagged your request for a human support agent / manager. Our team will review this thread and reach out shortly."
        else:
            fallback_msg = (
                "Thanks for reaching out! Our store offers 2-4 business day delivery nationwide with Cash on Delivery (COD) and 7-day hassle-free returns. "
                "How can I assist you with your order or products today?"
            )
        chat_service.add_message(
            session_id=session_id,
            role="assistant",
            content=fallback_msg,
            store_id=parsed_store_uuid,
            needs_human=True if is_escalate else None,
        )
        return fallback_msg, [], True

    turn = 0
    while turn < max_turns:
        turn += 1

        model_name = settings.LLM_MODEL or "openai/gpt-oss-120b"
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=OPENAI_TOOLS,
                tool_choice="auto",
                temperature=0.2,
            )
        except Exception as e:
            error_msg = f"❌ Error communicating with OpenAI: {str(e)}"
            logger.error(error_msg)
            return error_msg, tools_invoked_log, False

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        if tool_calls:
            # Save assistant tool request message
            tool_calls_dict = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                }
                for tc in tool_calls
            ]
            chat_service.add_message(
                session_id=session_id,
                role="assistant",
                content=response_message.content,
                tool_calls=tool_calls_dict,
                store_id=parsed_store_uuid,
                needs_human=True if is_escalate else None,
            )

            # Append to prompt messages
            messages.append(response_message)

            for tc in tool_calls:
                func_name = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}

                # Execute database tool
                tool_result = execute_tool_with_db(db, func_name, args, store_id=parsed_store_uuid)

                tools_invoked_log.append({
                    "tool_name": func_name,
                    "arguments": args,
                    "result": tool_result,
                })

                # Save tool response in DB
                chat_service.add_message(
                    session_id=session_id,
                    role="tool",
                    content=json.dumps(tool_result),
                    tool_call_id=tc.id,
                    name=func_name,
                    store_id=parsed_store_uuid,
                    needs_human=True if is_escalate else None,
                )

                # Append tool result to context
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": func_name,
                    "content": json.dumps(tool_result),
                })

            # Continue next turn with tool results in context
            continue

        # Final assistant answer produced
        final_answer = sanitize_ai_response(response_message.content or "")
        chat_service.add_message(
            session_id=session_id,
            role="assistant",
            content=final_answer,
            store_id=parsed_store_uuid,
            needs_human=True if is_escalate else None,
        )
        return final_answer, tools_invoked_log, True

    timeout_msg = "I'm sorry, I was unable to complete your request due to an execution limit."
    return timeout_msg, tools_invoked_log, False
