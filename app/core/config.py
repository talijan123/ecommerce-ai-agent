"""
Application Configuration Module using Pydantic Settings.
Loads environment variables seamlessly from .env file or system environment.
"""

import os
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DIRECT_SUPABASE_URL = "postgresql://postgres:Talal12%23%40%2C%2C@db.wmkhqqbpcppnekuzrpyb.supabase.co:5432/postgres"
DEFAULT_DB_URL = os.environ.get("DATABASE_URL") or DIRECT_SUPABASE_URL


class Settings(BaseSettings):
    PROJECT_NAME: str = "Autonomous E-Commerce AI Agent API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # JWT & Auth Security Settings
    SECRET_KEY: str = Field(default="super_secret_jwt_key_ecom_saas_auth_2026_x99!#")
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=10080)  # 7 days

    # LLM Provider Settings (Groq / OpenAI / Gemini / Any OpenAI-compatible provider)
    GROQ_API_KEY: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")
    GEMINI_API_KEY: str = Field(default="")
    GOOGLE_API_KEY: str = Field(default="")
    LLM_BASE_URL: str = Field(default="https://api.groq.com/openai/v1")
    LLM_MODEL: str = Field(default="openai/gpt-oss-120b")
    OPENAI_MODEL: str = Field(default="gpt-4o-mini")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash")

    # Meta WhatsApp Cloud API Settings
    WHATSAPP_TOKEN: str = Field(default="")
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default="1330161100179237")
    META_PHONE_NUMBER_ID: str = Field(default="1330161100179237")
    WHATSAPP_VERIFY_TOKEN: str = Field(default="autocommerce_wa_verify_token_123")
    WHATSAPP_API_VERSION: str = Field(default="v21.0")
    DEFAULT_WHATSAPP_PHONE: str = Field(default="15556494898")

    # Shopify Store API Settings (Live E-Commerce Integration)
    SHOPIFY_STORE_URL: str = Field(default="")
    SHOPIFY_ACCESS_TOKEN: str = Field(default="")
    SHOPIFY_API_VERSION: str = Field(default="2024-01")

    # Abandoned Cart Background Worker & Recovery Settings
    RECOVERY_CRON_INTERVAL_MINUTES: int = Field(default=15)
    RECOVERY_ABANDON_THRESHOLD_MINUTES: int = Field(default=30)
    ENABLE_RECOVERY_SCHEDULER: bool = Field(default=True)

    # Database Settings (Direct Supabase PostgreSQL connection)
    DATABASE_URL: str = Field(default=DEFAULT_DB_URL)

    # Supabase Client Settings (PostgREST / REST Client Integration)
    SUPABASE_URL: str = Field(default="https://wmkhqqbpcppnekuzrpyb.supabase.co")
    SUPABASE_KEY: str = Field(default="")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="")
    SUPABASE_ANON_KEY: str = Field(default="")

    # CORS Origins
    CORS_ORIGINS: List[str] = Field(default=["*"])

    # Super-Admin Privileges & Platform Control Access
    SUPER_ADMIN_EMAILS: Union[str, List[str]] = Field(
        default="aroobjan965@gmail.com,admin@autocommerce.ai,owner@store.com,talal@example.com"
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        if not v:
            return DIRECT_SUPABASE_URL
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.startswith("["):
                return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @field_validator("SUPER_ADMIN_EMAILS", mode="before")
    @classmethod
    def assemble_super_admin_emails(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("["):
                import json
                try:
                    return [str(e).strip().lower() for e in json.loads(v) if str(e).strip()]
                except Exception:
                    pass
            emails = [i.strip().lower() for i in v.split(",") if i.strip()]
            if "aroobjan965@gmail.com" not in emails:
                emails.append("aroobjan965@gmail.com")
            return emails
        elif isinstance(v, (list, set, tuple)):
            emails = [str(i).strip().lower() for i in v if str(i).strip()]
            if "aroobjan965@gmail.com" not in emails:
                emails.append("aroobjan965@gmail.com")
            return emails
        return ["aroobjan965@gmail.com", "admin@autocommerce.ai", "owner@store.com", "talal@example.com"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
