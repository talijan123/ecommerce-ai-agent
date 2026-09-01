"""
Application Configuration Module using Pydantic Settings.
Loads environment variables seamlessly from .env file or system environment.
"""

from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Autonomous E-Commerce AI Agent API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # LLM Provider Settings (Groq / OpenAI / Any OpenAI-compatible provider)
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.groq.com/openai/v1"
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Meta WhatsApp Cloud API Settings
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "autocommerce_wa_verify_token_123"
    WHATSAPP_API_VERSION: str = "v21.0"

    # Database Settings (Defaults to local SQLite, easily switchable to Supabase/PostgreSQL)
    DATABASE_URL: str = "sqlite:///./ecommerce.db"

    # CORS Origins
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
