"""
Authentication REST Endpoints (/api/v1/auth).
Provides signup with verification token generation, email verification,
secure JWT login, and authenticated user profile retrieval.
"""

import uuid
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.models.user import User
from app.schemas.auth import (
    UserSignupRequest,
    UserVerifyEmailRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    SignupResponse,
)

router = APIRouter()


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new merchant account",
)
def signup(
    payload: UserSignupRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new merchant user:
    - Verifies email uniqueness.
    - Hashes password securely via bcrypt.
    - Generates a verification token.
    - Returns 201 Created with verification token for testing/verification.
    """
    clean_email = payload.email.strip().lower()

    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with email '{clean_email}' already exists.",
        )

    verification_token = secrets.token_hex(16)
    hashed_pwd = get_password_hash(payload.password)

    new_user = User(
        id=uuid.uuid4(),
        email=clean_email,
        hashed_password=hashed_pwd,
        full_name=payload.full_name.strip() if payload.full_name else None,
        is_verified=False,
        verification_token=verification_token,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return SignupResponse(
        message="Account created successfully. Please verify your email to proceed.",
        email=new_user.email,
        is_verified=new_user.is_verified,
        verification_token=verification_token,
    )


@router.post(
    "/verify-email",
    summary="Verify merchant email with token",
)
def verify_email(
    payload: UserVerifyEmailRequest,
    db: Session = Depends(get_db),
):
    """
    Verify user email address:
    - Matches email and verification token.
    - Marks `is_verified = True` and clears token.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found for email '{clean_email}'.",
        )

    if user.is_verified:
        return {
            "success": True,
            "message": "Email is already verified.",
            "is_verified": True,
        }

    if not user.verification_token or user.verification_token.strip() != payload.verification_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )

    user.is_verified = True
    user.verification_token = None
    user.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "message": "Email verified successfully! You can now log in.",
        "is_verified": True,
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate merchant and obtain JWT access token",
)
def login(
    payload: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Log in with email and password:
    - Verifies password against bcrypt hash.
    - Ensures email is verified.
    - Returns signed JWT bearer access token.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email is not verified. Please verify your email before logging in.",
        )

    token_payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.full_name or "",
    }
    access_token = create_access_token(token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve profile details of the authenticated merchant.
    """
    return current_user
