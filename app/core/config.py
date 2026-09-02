"""
Application Configuration Module using Pydantic Settings.
Loads environment variables seamlessly from .env file or system environment.
"""

import os
from typing import List, Union
from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


IS_VERCEL = bool(os.environ.get("VERCEL"))
DEFAULT_DB_URL = "sqlite:////tmp/ecommerce.db" if IS_VERCEL else "sqlite:///./ecommerce.db"


class Settings(BaseSettings):
    PROJECT_NAME: str = "Autonomous E-Commerce AI Agent API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # LLM Provider Settings (Groq / OpenAI / Any OpenAI-compatible provider)
    GROQ_API_KEY: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")
    LLM_BASE_URL: str = Field(default="https://api.groq.com/openai/v1")
    LLM_MODEL: str = Field(default="llama-3.3-70b-versatile")
    OPENAI_MODEL: str = Field(default="gpt-4o-mini")

    # Meta WhatsApp Cloud API Settings
    WHATSAPP_TOKEN: str = Field(default="")
    WHATSAPP_PHONE_NUMBER_ID: str = Field(default="")
    WHATSAPP_VERIFY_TOKEN: str = Field(default="autocommerce_wa_verify_token_123")
    WHATSAPP_API_VERSION: str = Field(default="v21.0")

    # Database Settings (Defaults to local SQLite, easily switchable to Supabase/PostgreSQL)
    DATABASE_URL: str = Field(default=DEFAULT_DB_URL)

    # CORS Origins
    CORS_ORIGINS: List[str] = Field(default=["*"])

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.startswith("["):
                return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
