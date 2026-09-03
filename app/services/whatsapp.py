"""
WhatsApp Service Export Bridge.
"""

from app.services.whatsapp_service import (
    whatsapp_service,
    WhatsAppService,
    send_whatsapp_text_message,
    send_whatsapp_template_message,
)

__all__ = [
    "whatsapp_service",
    "WhatsAppService",
    "send_whatsapp_text_message",
    "send_whatsapp_template_message",
]
