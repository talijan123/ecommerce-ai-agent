"""
WhatsApp Cloud API Service: Handles outbound messages and status receipts to Meta Graph API.
Provides resilient asynchronous and synchronous messaging with automatic dry-run/mock logging.
"""

import logging
from typing import Optional, Dict, Any, List
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
        self._token = token
        self._phone_number_id = phone_number_id
        self._api_version = api_version

    @property
    def token(self) -> str:
        return self._token or settings.WHATSAPP_TOKEN

    @property
    def phone_number_id(self) -> str:
        return self._phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID

    @property
    def api_version(self) -> str:
        return self._api_version or settings.WHATSAPP_API_VERSION or "v21.0"

    @property
    def base_url(self) -> str:
        return f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"

    @property
    def is_configured(self) -> bool:
        """Check if live Meta credentials are provided."""
        return bool(
            self.token
            and self.phone_number_id
            and "your_" not in self.token
            and (self.token.startswith("EAA") or len(self.token) > 30)
            and str(self.phone_number_id).strip() != ""
            and "123456" not in str(self.phone_number_id)
        )

    def _clean_phone(self, phone: str) -> str:
        """Sanitize phone number to digits only."""
        return "".join(c for c in str(phone) if c.isdigit())

    async def send_text_message(self, to_phone_number: str, message_text: str) -> Dict[str, Any]:
        """
        Send an outbound text message to a customer's WhatsApp number (Async).
        """
        cleaned_phone = self._clean_phone(to_phone_number)

        # Mock / Dry-run handling if credentials are not configured
        if not self.is_configured:
            logger.info(
                f"📱 [WhatsApp Dry-Run] To: {cleaned_phone} | Message: {message_text[:120]}..."
            )
            return {
                "success": True,
                "mock": True,
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
            "text": {"preview_url": True, "body": message_text},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info(f"✅ WhatsApp message delivered to {cleaned_phone}: {data}")
                return {"success": True, "data": data, "mock": False, "status_code": response.status_code}
        except httpx.HTTPStatusError as e:
            error_details = e.response.text
            logger.error(f"❌ Meta Graph API Error ({e.response.status_code}): {error_details}")
            return {"success": False, "error": error_details, "status_code": e.response.status_code, "mock": False}
        except Exception as e:
            logger.error(f"❌ Failed to dispatch WhatsApp message: {str(e)}")
            return {"success": False, "error": str(e), "mock": False}

    def send_text_message_sync(self, to_phone_number: str, message_text: str) -> Dict[str, Any]:
        """
        Synchronous wrapper for outbound text messaging.
        """
        cleaned_phone = self._clean_phone(to_phone_number)

        if not self.is_configured:
            logger.info(
                f"📱 [WhatsApp Dry-Run (Sync)] To: {cleaned_phone} | Message: {message_text[:120]}..."
            )
            return {
                "success": True,
                "mock": True,
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
            "text": {"preview_url": True, "body": message_text},
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info(f"✅ WhatsApp message delivered to {cleaned_phone}: {data}")
                return {"success": True, "data": data, "mock": False, "status_code": response.status_code}
        except httpx.HTTPStatusError as e:
            error_details = e.response.text
            logger.error(f"❌ Meta Graph API Error ({e.response.status_code}): {error_details}")
            return {"success": False, "error": error_details, "status_code": e.response.status_code, "mock": False}
        except Exception as e:
            logger.error(f"❌ Failed to dispatch WhatsApp message: {str(e)}")
            return {"success": False, "error": str(e), "mock": False}

    async def send_template_message(
        self,
        to_phone_number: str,
        template_name: str,
        components: Optional[List[Dict[str, Any]]] = None,
        language_code: str = "en_US",
    ) -> Dict[str, Any]:
        """
        Send an official Meta pre-approved WhatsApp template message (Async).
        """
        cleaned_phone = self._clean_phone(to_phone_number)

        if not self.is_configured:
            logger.info(
                f"📱 [WhatsApp Template Dry-Run] To: {cleaned_phone} | Template: {template_name}"
            )
            return {
                "success": True,
                "mock": True,
                "recipient": cleaned_phone,
                "template": template_name,
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
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": components or [],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return {"success": True, "data": data, "mock": False}
        except Exception as e:
            logger.error(f"❌ WhatsApp template dispatch failed: {str(e)}")
            return {"success": False, "error": str(e), "mock": False}

    async def mark_message_as_read(self, message_id: str) -> bool:
        """
        Mark an incoming WhatsApp message as read to display blue checkmarks to the user.
        """
        if not self.is_configured:
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


# Top-level helper functions for direct module-level import
def send_whatsapp_text_message(to_phone: str, message: str) -> Dict[str, Any]:
    """Helper function to send a text message via whatsapp_service."""
    return whatsapp_service.send_text_message_sync(to_phone, message)


async def send_whatsapp_template_message(
    to_phone: str, template_name: str, components: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Helper function to send a template message via whatsapp_service."""
    return await whatsapp_service.send_template_message(to_phone, template_name, components)
