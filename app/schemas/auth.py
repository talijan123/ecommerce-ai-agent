"""
Pydantic Schemas for Authentication, Email Verification, and User Profiles.
"""

from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class UserSignupRequest(BaseModel):
    email: EmailStr = Field(..., description="Merchant account email address")
    password: str = Field(..., min_length=6, max_length=128, description="Secure account password (min 6 characters)")
    full_name: Optional[str] = Field(None, max_length=255, description="Full name or company representative")


class UserVerifyEmailRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    verification_token: str = Field(..., min_length=1, description="Verification token sent upon signup")


class UserLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., min_length=1, description="Account password")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "merchant"
    is_verified: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class SignupResponse(BaseModel):
    message: str
    email: EmailStr
    is_verified: bool
    verification_token: Optional[str] = None  # Included in dev/test mode for verification
