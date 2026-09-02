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
1. **NO HALLUCINATIONS**: Never guess, assume, or fabricate order numbers, shipping details, tracking links, inventory stock levels, or discounts. You MUST ALWAYS call the appropriate tool first to retrieve verified real-time data from the store database before answering.
2. **INVENTORY & OUT-OF-STOCK HANDLING**:
   - If a customer asks for a product or size that is out of stock (stock_count = 0 or in_stock = false), explicitly state that the item is currently out of stock.
   - Proactively suggest any other available sizes that are in stock for that product, or suggest related products.
3. **MULTILINGUAL & ROMAN URDU SUPPORT**:
   - You natively understand and communicate in multiple languages, especially Roman Urdu (e.g., "Mera order 1043 kab deliver hoga?", "Kia ye shirt size M me available hai?").
   - When a user asks in Roman Urdu, respond politely and naturally in Roman Urdu (e.g., "Aapka order #1043 filhal processing me hai aur kal tak deliver ho jayega.").
   - Maintain a courteous, professional, and friendly tone in all languages.
4. **TOOL CALLING FORMAT**:
   - Always extract parameters accurately (e.g., clean order IDs like '1042' from '#1042' or 'order 1042').
   - Synthesize the tool output clearly, mentioning order status, tracking links, dates, and item names where relevant.
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
    max_turns: int = 5,
) -> Tuple[str, List[Dict[str, Any]], bool]:
    """
    Execute a full multi-turn tool interaction loop for a user query.

    Args:
        db: Active SQLAlchemy database session.
        session_id: Conversation session identifier.
        user_message: Natural language customer query.
        customer_email: Optional customer email for session context.
        max_turns: Maximum tool execution turns to prevent infinite loops.

    Returns:
        Tuple of (response_text, list_of_tool_invocations, success_flag)
    """
    chat_service = ChatService(db)
    client = get_openai_client()

    # If email is provided in the request, append context if not already mentioned
    full_user_input = user_message
    if customer_email and "@" in customer_email and customer_email.lower() not in user_message.lower():
        full_user_input = f"{user_message} (My email is: {customer_email})"

    # Fetch prior conversation history from database
    prior_messages = chat_service.get_history(session_id, limit=12)

    # Persist the new user query
    chat_service.add_message(session_id=session_id, role="user", content=full_user_input)

    # Build prompt messages array
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(prior_messages)
    messages.append({"role": "user", "content": full_user_input})

    tools_invoked_log: List[Dict[str, Any]] = []

    if client is None:
        # Fallback simulation when no live Groq or OpenAI key is configured
        fallback_msg = (
            "⚠️ [API Notice]: Neither GROQ_API_KEY nor OPENAI_API_KEY is configured in the environment. "
            "Please configure your API key in environment variables to enable live AI responses."
        )
        chat_service.add_message(session_id=session_id, role="assistant", content=fallback_msg)
        return fallback_msg, [], True

    turn = 0
    while turn < max_turns:
        turn += 1

        model_name = settings.LLM_MODEL or "llama-3.3-70b-versatile"
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
                tool_result = execute_tool_with_db(db, func_name, args)

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
        final_answer = response_message.content or ""
        chat_service.add_message(session_id=session_id, role="assistant", content=final_answer)
        return final_answer, tools_invoked_log, True

    timeout_msg = "I'm sorry, I was unable to complete your request due to an execution limit."
    return timeout_msg, tools_invoked_log, False
