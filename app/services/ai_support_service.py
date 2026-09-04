"""
AI Customer Support Service for WhatsApp Inbound Conversations.
Powered by Google Gemini API (gemini-2.5-flash) with seamless multi-model fallback.
Generates concise, friendly, and grounded support replies for active customers and abandoned cart recoveries.
"""

import os
import re
import logging
import requests
from typing import Optional
from app.core.config import settings
from app.models.cart import CartSession

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are a friendly, helpful WhatsApp customer support assistant for the AutoCommerce store.\n\n"
    "CRITICAL RULES & DIRECTIVES:\n"
    "1. Keep replies concise, helpful, and natural (1 to 3 short sentences maximum). Ideal for WhatsApp reading.\n"
    "2. Language Matching: Match the customer's language. If they message in Roman Urdu (e.g., 'mera order kab tak deliver hoga?', 'kya delivery free hai?', 'kya COD hai?'), reply warmly and politely in Roman Urdu (e.g., 'Aapka order 2-4 business days me deliver ho jayega. Cash on Delivery (COD) bhi available hai!'). If they write in English, reply in English.\n"
    "3. Store Knowledge & Policies:\n"
    "   - Standard Delivery Time: 2 to 4 business days.\n"
    "   - Payment Methods: Cash on Delivery (COD) is available nationwide.\n"
    "   - Return Policy: 7-day hassle-free return and replacement policy.\n"
    "   - Cart & Discounts: If the customer context has an active discount code or cart items, mention them warmly to encourage checkout.\n"
    "4. Format: Do NOT use markdown headers, long bulleted lists, or robotic greetings. Use a warm tone and suitable emojis (e.g., 📦, ✨, 😊)."
)

FALLBACK_SUPPORT_REPLY = (
    "Thanks for reaching out! 😊 Standard delivery takes 2-4 business days with Cash on Delivery (COD) available nationwide. "
    "We also offer a 7-day return policy. If you have an active cart, your discount is already applied via the checkout link!"
)


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

        if context_parts:
            context_header = "Customer Store Context:\n" + "\n".join(f"- {c}" for c in context_parts)
            return f"{context_header}\n\nCustomer WhatsApp Message:\n\"{customer_message}\"\n\nReply (1-3 sentences, match language):"
        else:
            return f"Customer WhatsApp Message:\n\"{customer_message}\"\n\nReply (1-3 sentences, match language):"

    def _call_gemini_api(self, prompt: str, api_key: str, model: str) -> Optional[str]:
        """Direct REST call to Google Gemini generateContent endpoint with automatic model fallback and resilient timeout."""
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

            payload = {
                "system_instruction": {
                    "parts": [{"text": self.system_instruction}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 1000,
                    "thinkingConfig": {"thinkingBudget": 0},
                }
            }

            try:
                response = requests.post(url, json=payload, timeout=20)
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            reply = parts[0]["text"].strip()
                            reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                            if reply:
                                return reply
                elif response.status_code == 400:
                    # Model may not support thinkingConfig, retry without it
                    payload["generationConfig"] = {
                        "temperature": 0.3,
                        "maxOutputTokens": 800,
                    }
                    retry_resp = requests.post(url, json=payload, timeout=20)
                    if retry_resp.status_code == 200:
                        data = retry_resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                reply = parts[0]["text"].strip()
                                reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                                if reply:
                                    return reply
                    logger.info(f"[AISupport] Gemini model {clean_model} status 400, trying next model...")
                    continue
                elif response.status_code in (404, 503):
                    # Model not available or temporarily overloaded, try next candidate
                    logger.info(f"[AISupport] Gemini model {clean_model} status {response.status_code}, trying next model...")
                    continue
                else:
                    logger.warning(
                        f"[AISupport] Gemini API ({clean_model}) returned status {response.status_code}: {response.text[:200]}"
                    )
            except requests.exceptions.Timeout:
                logger.warning(f"[AISupport] Gemini API request timed out (20s) for model {clean_model}, trying next candidate...")
                continue
            except Exception as e:
                logger.warning(f"[AISupport] Error requesting Gemini model {clean_model}: {e}")

        return None

    def _call_groq_fallback(self, prompt: str) -> Optional[str]:
        """Fallback to Groq / OpenAI LLM provider with multi-model fallback and resilient timeout."""
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
            candidate_models = []
            if settings.LLM_MODEL:
                candidate_models.append(settings.LLM_MODEL)
            for m in [
                "llama-3.3-70b-versatile",
                "llama-3.1-8b-instant",
                "groq/compound",
                "openai/gpt-oss-120b",
                "groq/compound-mini",
                "openai/gpt-oss-20b",
                "qwen/qwen3.8-27b",
            ]:
                if m not in candidate_models:
                    candidate_models.append(m)

            for model_name in candidate_models:
                try:
                    completion = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": self.system_instruction},
                            {"role": "user", "content": prompt},
                        ],
                        max_tokens=200,
                        temperature=0.3,
                    )
                    if completion.choices and completion.choices[0].message.content:
                        reply = completion.choices[0].message.content.strip()
                        reply = re.sub(r"<think>.*?</think>", "", reply, flags=re.DOTALL).strip()
                        if reply:
                            logger.info(f"🤖 [AISupport] Groq fallback ({model_name}) reply generated successfully.")
                            return reply
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
    ) -> str:
        """
        Generate contextual AI response for an inbound customer WhatsApp message.
        Tries Gemini API -> Groq/OpenAI -> Hardcoded resilient Fallback.
        """
        if not customer_message or not customer_message.strip():
            return self.fallback_reply

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

        # 1. Attempt Gemini API
        if gemini_key and not gemini_key.startswith("your_"):
            try:
                reply = self._call_gemini_api(prompt=prompt, api_key=gemini_key, model=gemini_model)
                if reply:
                    logger.info(f"🤖 [AISupport] Gemini AI ({gemini_model}) reply generated successfully.")
                    return reply
            except Exception as e:
                logger.warning(f"⚠️ [AISupport] Gemini API invocation failed: {e}")

        # 2. Attempt secondary LLM Provider (Groq / OpenAI)
        try:
            secondary_reply = self._call_groq_fallback(prompt=prompt)
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
