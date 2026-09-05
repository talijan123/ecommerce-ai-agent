"""
Pydantic Schemas for Multi-Tenant Store Management and Onboarding.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator


class StoreBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Store or merchant display name")
    owner_email: EmailStr = Field(..., description="Store owner's contact email")
    whatsapp_phone_number_id: str = Field(
        ..., min_length=1, max_length=100, description="Unique Meta WhatsApp Phone Number ID"
    )
    system_prompt: Optional[str] = Field(
        default="You are a professional e-commerce AI assistant. Help customers track orders and check product inventory accurately.",
        description="Custom AI assistant system prompt / tone instructions",
    )


class StoreCreate(StoreBase):
    whatsapp_access_token: str = Field(
        ..., min_length=1, description="Meta WhatsApp Cloud API system user access token"
    )


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    owner_email: Optional[EmailStr] = None
    system_prompt: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    is_active: Optional[bool] = None


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_email: str
    whatsapp_phone_number_id: str
    system_prompt: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    has_access_token: bool = False
    masked_access_token: Optional[str] = None

    @model_validator(mode="wrap")
    @classmethod
    def populate_masked_token(cls, data, handler):
        # Inspect raw attributes if ORM model or dict
        token = None
        if hasattr(data, "whatsapp_access_token"):
            token = getattr(data, "whatsapp_access_token", None)
        elif isinstance(data, dict):
            token = data.get("whatsapp_access_token")

        res = handler(data)

        if token:
            res.has_access_token = True
            token_str = str(token).strip()
            if len(token_str) >= 12:
                res.masked_access_token = f"{token_str[:6]}...{token_str[-4:]}"
            else:
                res.masked_access_token = "******"
        else:
            res.has_access_token = False
            res.masked_access_token = None

        return res
