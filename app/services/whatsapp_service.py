"""
WhatsApp Cloud API Service: Handles outbound messages and status receipts to Meta Graph API.
"""

import logging
from typing import Optional, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(
        self,
        token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        api_version: Optional[str] = None,
    ):
        self.token = token or settings.WHATSAPP_TOKEN
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        self.api_version = api_version or settings.WHATSAPP_API_VERSION
        self.base_url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"

    async def send_text_message(self, to_phone_number: str, message_text: str) -> Dict[str, Any]:
        """
        Send an outbound text message to a customer's WhatsApp number.

        Args:
            to_phone_number: Destination phone number in international format (e.g., '923001234567' or '+14155552671').
            message_text: The synthesized AI assistant response.

        Returns:
            Dict containing API response details or mock success acknowledgment.
        """
        # Clean phone number (remove '+', spaces, dashes)
        cleaned_phone = to_phone_number.replace("+", "").replace(" ", "").replace("-", "").strip()

        # If credentials are not set (e.g. local testing / dev mode), log and simulate success
        if not self.token or not self.phone_number_id or "your_" in self.token:
            logger.info(
                f"📱 [WhatsApp Mock Dispatch]: Simulated reply to {cleaned_phone}: {message_text[:80]}..."
            )
            return {
                "success": True,
                "simulated": True,
                "recipient": cleaned_phone,
                "message": message_text,
            }

        url = f"{self.base_url}/messages"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": cleaned_phone,
            "type": "text",
            "text": {"preview_url": False, "body": message_text},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info(f"✅ WhatsApp message successfully sent to {cleaned_phone}: {data}")
                return {"success": True, "data": data}
        except httpx.HTTPStatusError as e:
            error_details = e.response.text
            logger.error(f"❌ Meta Graph API Error ({e.response.status_code}): {error_details}")
            return {"success": False, "error": error_details}
        except Exception as e:
            logger.error(f"❌ Failed to dispatch WhatsApp message: {str(e)}")
            return {"success": False, "error": str(e)}

    async def mark_message_as_read(self, message_id: str) -> bool:
        """
        Mark an incoming WhatsApp message as read to display blue checkmarks to the user.
        """
        if not self.token or not self.phone_number_id or "your_" in self.token:
            return True

        url = f"{self.base_url}/messages"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload, headers=headers)
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"⚠️ Could not mark message {message_id} as read: {e}")
            return False


# Singleton instance
whatsapp_service = WhatsAppService()
