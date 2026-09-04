"""
AI Customer Support Service for WhatsApp Inbound Conversations.
Powered by Google Gemini API (gemini-2.5-flash) with seamless multi-model fallback.
Generates concise, friendly, and grounded support replies for active customers and abandoned cart recoveries.
"""

import os
import logging
import requests
from typing import Optional
from app.core.config import settings
from app.models.cart import CartSession

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are the friendly WhatsApp customer support assistant for AutoCommerce store. "
    "Keep replies concise (under 50 words), helpful, and professional. "
    "Mention that standard delivery is 2-4 business days and their discount code is active in the link previously sent."
)

FALLBACK_SUPPORT_REPLY = (
    "Thanks for reaching out! Our team is here to help. "
    "Standard delivery takes 2-4 days, and your cart discount is active via the link above."
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
        """Construct user prompt incorporating customer cart and discount context if available."""
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

        if context_parts:
            context_header = "Customer Store Context:\n" + "\n".join(f"- {c}" for c in context_parts)
            return f"{context_header}\n\nCustomer WhatsApp Message:\n\"{customer_message}\""
        else:
            return f"Customer WhatsApp Message:\n\"{customer_message}\""

    def _call_gemini_api(self, prompt: str, api_key: str, model: str) -> Optional[str]:
        """Direct REST call to Google Gemini generateContent endpoint with strict timeout."""
        clean_model = model or "gemini-2.5-flash"
        # Support model names with or without 'models/' prefix
        if clean_model.startswith("models/"):
            clean_model = clean_model.replace("models/", "", 1)

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
                "maxOutputTokens": 150,
            }
        }

        response = requests.post(url, json=payload, timeout=6)
        if response.status_code == 200:
            data = response.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and "text" in parts[0]:
                    reply = parts[0]["text"].strip()
                    if reply:
                        return reply
        else:
            logger.warning(
                f"[AISupport] Gemini API returned status {response.status_code}: {response.text[:200]}"
            )
        return None

    def _call_groq_fallback(self, prompt: str) -> Optional[str]:
        """Fallback to Groq / OpenAI LLM provider if Gemini key is unset or unresponsive."""
        api_key = settings.GROQ_API_KEY or settings.OPENAI_API_KEY
        if not api_key:
            return None

        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=api_key,
                base_url=settings.LLM_BASE_URL or "https://api.groq.com/openai/v1",
                timeout=6,
            )
            model_name = settings.LLM_MODEL or "llama-3.3-70b-versatile"
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": self.system_instruction},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=150,
                temperature=0.3,
            )
            return completion.choices[0].message.content.strip()
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
