"""
AI Customer Support Service for WhatsApp Inbound Conversations.
Powered by Google Gemini API (gemini-2.5-flash) with dynamic Supabase Function Calling,
multi-turn conversation memory, and seamless fallback (Groq / OpenAI / Deterministic).
Generates concise, friendly, and grounded support replies for active customers and abandoned cart recoveries.
"""

import os
import re
import json
import logging
import requests
from typing import Optional, Dict, Any, List
from app.core.config import settings
from app.models.cart import CartSession
from app.services.supabase_service import (
    track_order,
    check_product_stock,
    execute_supabase_tool,
)

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are a friendly, helpful WhatsApp customer support assistant for the AutoCommerce store.\n\n"
    "CRITICAL RULES & DIRECTIVES:\n"
    "1. Keep replies concise, helpful, and natural (1 to 3 short sentences maximum). Ideal for WhatsApp reading.\n"
    "2. NO HALLUCINATIONS: When a customer asks about order status or product stock/inventory, you MUST call the provided tools (track_order, check_product_stock) to retrieve real-time data from the store database before answering.\n"
    "3. MULTI-TURN CONTEXT RESOLUTION: Use the conversation history to understand references (e.g. 'aur iski price kya hai?', 'is it available in blue?', 'where is it now?') based on previous products or orders discussed.\n"
    "4. Language Matching: Match the customer's language. If they message in Roman Urdu (e.g., 'mera order kab tak deliver hoga?', 'kya delivery free hai?', 'kya COD hai?'), reply warmly and politely in Roman Urdu (e.g., 'Aapka order 2-4 business days me deliver ho jayega. Cash on Delivery (COD) bhi available hai!'). If they write in English, reply in English.\n"
    "5. Store Knowledge & Policies:\n"
    "   - Standard Delivery Time: 2 to 4 business days.\n"
    "   - Payment Methods: Cash on Delivery (COD) is available nationwide.\n"
    "   - Return Policy: 7-day hassle-free return and replacement policy.\n"
    "   - Cart & Discounts: If the customer context has an active discount code or cart items, mention them warmly to encourage checkout.\n"
    "6. Format: Do NOT use markdown headers, long bulleted lists, or robotic greetings. Use a warm tone and suitable emojis (e.g., 📦, ✨, 😊)."
)

FALLBACK_SUPPORT_REPLY = (
    "Thanks for reaching out! 😊 Standard delivery takes 2-4 business days with Cash on Delivery (COD) available nationwide. "
    "We also offer a 7-day return policy. If you have an active cart, your discount is already applied via the checkout link!"
)

# Gemini Tool Declarations for Function Calling
GEMINI_FUNCTION_DECLARATIONS = [
    {
        "name": "track_order",
        "description": "Queries the orders table in the database to track an order's status, courier, tracking number, created date, and items.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "order_id": {
                    "type": "STRING",
                    "description": "The unique Order ID or order number provided by the customer (e.g., '1042', 'ORD-101')."
                }
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "check_product_stock",
        "description": "Queries the products/inventory table in the database for stock quantity, price, and in-stock availability.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "product_name": {
                    "type": "STRING",
                    "description": "The name or search keyword of the product in the store catalog (e.g., 'Minimalist Ceramic Lamp', 'Headphones')."
                }
            },
            "required": ["product_name"]
        }
    }
]

GEMINI_TOOLS = [
    {
        "function_declarations": GEMINI_FUNCTION_DECLARATIONS
    }
]


class AISupportService:
    def __init__(
        self,
        system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION,
        fallback_reply: str = FALLBACK_SUPPORT_REPLY,
    ):
        self.system_instruction = system_instruction
        self.fallback_reply = fallback_reply

    def _build_contextual_prompt(
        self,
        customer_message: str,
        cart_session: Optional[CartSession] = None,
        customer_phone: Optional[str] = None,
    ) -> str:
        """Construct user prompt incorporating customer cart, order, and discount context if available."""
        context_parts = []

        if customer_phone:
            context_parts.append(f"Customer Phone: {customer_phone}")

        if cart_session:
            if cart_session.customer_name and cart_session.customer_name != "Valued Customer":
                context_parts.append(f"Customer Name: {cart_session.customer_name}")
            if cart_session.discount_code:
                context_parts.append(
                    f"Active Discount: Code '{cart_session.discount_code}' ({cart_session.discount_percentage}% off)"
                )
            if cart_session.abandoned_items:
                item_names = [
                    item.get("name") or item.get("title") or "Item"
                    for item in (cart_session.abandoned_items or [])
                ]
                context_parts.append(f"Cart Items: {', '.join(item_names[:3])}")
                try:
                    total = sum(float(item.get("price", 0)) * int(item.get("quantity", 1)) for item in cart_session.abandoned_items if isinstance(item, dict))
                    if total > 0:
                        context_parts.append(f"Cart Total: ${total:.2f}")
                except Exception:
                    pass

        # Check if customer message contains an explicit order reference
        order_match = re.search(r"(?:order\s*#?|#)([A-Za-z0-9-]+)", customer_message, re.IGNORECASE)
        if order_match:
            try:
                from app.services.ecommerce_service import ecommerce_service
                order_num = order_match.group(1).strip()
                if order_num:
                    order_res = ecommerce_service.get_order_by_number(order_num, phone=customer_phone)
                    if order_res.get("success"):
                        context_parts.append(
                            f"Verified Order #{order_res.get('order_id')} Status: {order_res.get('status')}, "
                            f"Carrier: {order_res.get('carrier') or 'N/A'}, "
                            f"Tracking: {order_res.get('tracking_number') or 'Pending'}, "
                            f"Estimated Delivery: {order_res.get('estimated_delivery') or '2-4 business days'}"
                        )
                    elif order_res.get("security_error"):
                        context_parts.append(
                            f"Order #{order_num} Security Warning: Customer phone ({customer_phone}) does not match order phone. "
                            "Do NOT share order details. Politely ask customer to contact support from their registered phone number."
                        )
            except Exception as e:
                logger.warning(f"Error checking order in prompt context: {e}")

        if context_parts:
            context_header = "Customer Store Context:\n" + "\n".join(f"- {c}" for c in context_parts)
            return f"{context_header}\n\nCustomer WhatsApp Message:\n\"{customer_message}\"\n\nReply (1-3 sentences, match language):"
        else:
            return f"Customer WhatsApp Message:\n\"{customer_message}\"\n\nReply (1-3 sentences, match language):"

    def _call_gemini_api(
        self,
        prompt: str,
        api_key: str,
        model: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        max_turns: int = 5,
    ) -> Optional[str]:
        """
        Direct REST call to Google Gemini generateContent endpoint with multi-turn conversation memory,
        dynamic Supabase Function Calling loop, and automatic model fallback.
        """
        primary_model = (model or "gemini-2.5-flash").replace("models/", "")
        candidate_models = [primary_model]
        for fallback_model in [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-3.5-flash",
            "gemini-3.6-flash",
        ]:
            if fallback_model not in candidate_models:
                candidate_models.append(fallback_model)

        for clean_model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"

            # 1. Build initial contents payload incorporating past multi-turn chat history
            contents: List[Dict[str, Any]] = []
            if chat_history:
                for turn in chat_history:
                    if isinstance(turn, dict) and "role" in turn and "parts" in turn:
                        contents.append(turn)

            # Append current turn prompt
            if contents and contents[-1].get("role") == "user":
                prev_text = contents[-1]["parts"][0].get("text", "")
                contents[-1]["parts"][0]["text"] = f"{prev_text}\n{prompt}"
            else:
                contents.append({
                    "role": "user",
                    "parts": [{"text": prompt}]
                })

            turn = 0
            model_failed = False

            while turn < max_turns:
                turn += 1

                payload = {
                    "system_instruction": {
                        "parts": [{"text": self.system_instruction}]
                    },
                    "contents": contents,
                    "tools": GEMINI_TOOLS,
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 1000,
                    }
                }

                try:
                    response = requests.post(url, json=payload, timeout=20)
                    if response.status_code == 200:
                        data = response.json()
                        candidates = data.get("candidates", [])
                        if not candidates:
                            model_failed = True
                            break

                        candidate_content = candidates[0].get("content", {})
                        parts = candidate_content.get("parts", [])
                        if not parts:
                            model_failed = True
                            break

                        # Check for functionCall in parts
                        func_call = None
                        for p in parts:
                            if "functionCall" in p:
                                func_call = p["functionCall"]
                                break
                            elif "function_call" in p:
                                func_call = p["function_call"]
                                break

                        if func_call:
                            func_name = func_call.get("name")
                            func_args = func_call.get("args", {})
                            logger.info(f"🔧 [Gemini Function Call ({clean_model})]: {func_name}({func_args})")

                            # Execute the Supabase tool function
                            tool_result = execute_supabase_tool(func_name, func_args)
                            logger.info(f"📦 [Supabase Tool Output]: {tool_result}")

                            # Append assistant's functionCall turn to contents
                            contents.append({
                                "role": "model",
                                "parts": parts
                            })

                            # Append tool function response to contents
                            contents.append({
                                "role": "function",
                                "parts": [
                                    {
                                        "functionResponse": {
                                            "name": func_name,
                                            "response": {
                                                "name": func_name,
                                                "content": tool_result
                                            }
                                        }
                                    }
                                ]
                            })

                            # Continue loop so Gemini synthesizes response with tool result
                            continue

                        # If no functionCall, extract text response
                        for p in parts:
                            if "text" in p and p["text"]:
                                reply = p["text"].strip()
                                reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                                if reply:
                                    logger.info(f"🤖 [AISupport] Gemini ({clean_model}) final response generated.")
                                    return reply

                        break

                    elif response.status_code == 400:
                        # Model may not support tools schema, try fallback generation
                        logger.info(f"[AISupport] Gemini model {clean_model} status 400, retrying simple generation...")
                        simple_payload = {
                            "system_instruction": {"parts": [{"text": self.system_instruction}]},
                            "contents": contents,
                            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800}
                        }
                        simple_resp = requests.post(url, json=simple_payload, timeout=20)
                        if simple_resp.status_code == 200:
                            s_data = simple_resp.json()
                            s_cands = s_data.get("candidates", [])
                            if s_cands:
                                s_parts = s_cands[0].get("content", {}).get("parts", [])
                                if s_parts and "text" in s_parts[0]:
                                    s_reply = s_parts[0]["text"].strip()
                                    s_reply = re.sub(r"<think>.*?</think>", "", s_reply, flags=re.DOTALL).strip()
                                    if s_reply:
                                        return s_reply
                        model_failed = True
                        break

                    elif response.status_code in (404, 503):
                        logger.info(f"[AISupport] Gemini model {clean_model} status {response.status_code}, trying next model...")
                        model_failed = True
                        break
                    else:
                        logger.warning(
                            f"[AISupport] Gemini API ({clean_model}) returned status {response.status_code}: {response.text[:200]}"
                        )
                        model_failed = True
                        break

                except requests.exceptions.Timeout:
                    logger.warning(f"[AISupport] Gemini API request timed out (20s) for model {clean_model}")
                    model_failed = True
                    break
                except Exception as e:
                    logger.warning(f"[AISupport] Error requesting Gemini model {clean_model}: {e}")
                    model_failed = True
                    break

            if not model_failed:
                pass

        return None

    def _call_groq_fallback(
        self,
        prompt: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[str]:
        """Fallback to Groq / OpenAI LLM provider with multi-turn memory and tool execution loop."""
        api_key = settings.GROQ_API_KEY or settings.OPENAI_API_KEY
        if not api_key:
            return None

        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=api_key,
                base_url=settings.LLM_BASE_URL or "https://api.groq.com/openai/v1",
                timeout=15,
            )

            openai_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "track_order",
                        "description": "Queries the orders table in the database to track an order's status, courier, tracking number, and items.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "order_id": {"type": "string", "description": "The unique Order ID or order number."}
                            },
                            "required": ["order_id"]
                        }
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "check_product_stock",
                        "description": "Queries the products/inventory table in the database for stock quantity, price, and in-stock availability.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "product_name": {"type": "string", "description": "The product name or search term."}
                            },
                            "required": ["product_name"]
                        }
                    }
                }
            ]

            candidate_models = []
            if settings.LLM_MODEL:
                candidate_models.append(settings.LLM_MODEL)
            for m in [
                "openai/gpt-oss-120b",
                "groq/compound",
                "groq/compound-mini",
                "openai/gpt-oss-20b",
                "qwen/qwen3.8-27b",
                "llama-3.3-70b-versatile",
                "llama-3.1-8b-instant",
            ]:
                if m not in candidate_models:
                    candidate_models.append(m)

            for model_name in candidate_models:
                try:
                    messages = [{"role": "system", "content": self.system_instruction}]

                    # Append past chat turns
                    if chat_history:
                        for h in chat_history:
                            r = "assistant" if h.get("role") == "model" else "user"
                            txt = ""
                            parts = h.get("parts", [])
                            if parts and isinstance(parts[0], dict):
                                txt = parts[0].get("text", "")
                            if txt:
                                messages.append({"role": r, "content": txt})

                    messages.append({"role": "user", "content": prompt})

                    turn = 0
                    while turn < 4:
                        turn += 1
                        completion = client.chat.completions.create(
                            model=model_name,
                            messages=messages,
                            tools=openai_tools,
                            tool_choice="auto",
                            max_tokens=300,
                            temperature=0.3,
                        )

                        resp_msg = completion.choices[0].message
                        if resp_msg.tool_calls:
                            messages.append(resp_msg)
                            for tc in resp_msg.tool_calls:
                                f_name = tc.function.name
                                try:
                                    f_args = json.loads(tc.function.arguments)
                                except Exception:
                                    f_args = {}
                                t_res = execute_supabase_tool(f_name, f_args)
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc.id,
                                    "name": f_name,
                                    "content": json.dumps(t_res),
                                })
                            continue

                        if resp_msg.content:
                            reply = resp_msg.content.strip()
                            reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                            if reply:
                                logger.info(f"🤖 [AISupport] Groq fallback ({model_name}) reply generated successfully.")
                                return reply
                        break

                except Exception as model_err:
                    logger.warning(f"[AISupport] Groq model {model_name} failed: {model_err}")
                    continue

            return None
        except Exception as e:
            logger.warning(f"[AISupport] LLM fallback call error: {e}")
            return None

    def generate_support_reply(
        self,
        customer_message: str,
        cart_session: Optional[CartSession] = None,
        customer_phone: Optional[str] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        db: Optional[Any] = None,
    ) -> str:
        """
        Generate contextual AI response for an inbound customer WhatsApp message.
        Tries Gemini API with multi-turn chat memory & function calling -> Groq/OpenAI -> Guaranteed Fallback.
        """
        if not customer_message or not customer_message.strip():
            return self.fallback_reply

        # Auto-fetch multi-turn chat history if db and customer_phone are provided but history was not
        if chat_history is None and customer_phone and db is not None:
            try:
                from app.services.chat_service import ChatService
                cs = ChatService(db)
                chat_history = cs.get_gemini_history(f"wa_{customer_phone}", limit=10, max_inactivity_hours=4.0)
            except Exception as e:
                logger.warning(f"Could not load chat history for {customer_phone}: {e}")

        prompt = self._build_contextual_prompt(
            customer_message=customer_message.strip(),
            cart_session=cart_session,
            customer_phone=customer_phone,
        )

        gemini_key = (
            settings.GEMINI_API_KEY
            or settings.GOOGLE_API_KEY
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY")
        )
        gemini_model = settings.GEMINI_MODEL or "gemini-2.5-flash"

        # 1. Attempt Gemini API with Multi-turn history and Function Calling
        if gemini_key and not gemini_key.startswith("your_"):
            try:
                reply = self._call_gemini_api(
                    prompt=prompt,
                    api_key=gemini_key,
                    model=gemini_model,
                    chat_history=chat_history,
                )
                if reply:
                    logger.info(f"🤖 [AISupport] Gemini AI ({gemini_model}) reply generated successfully.")
                    return reply
            except Exception as e:
                logger.warning(f"⚠️ [AISupport] Gemini API invocation failed: {e}")

        # 2. Attempt secondary LLM Provider (Groq / OpenAI) with history and tool calling
        try:
            secondary_reply = self._call_groq_fallback(prompt=prompt, chat_history=chat_history)
            if secondary_reply:
                logger.info("🤖 [AISupport] Secondary LLM reply generated successfully.")
                return secondary_reply
        except Exception as e:
            logger.warning(f"⚠️ [AISupport] Secondary LLM fallback failed: {e}")

        # 3. Default guaranteed response
        logger.info("ℹ️ [AISupport] Using guaranteed fallback response.")
        return self.fallback_reply


# Global singleton instance
ai_support_service = AISupportService()
