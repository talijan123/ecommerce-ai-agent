"""
Store Onboarding and Multi-Tenant Management Endpoints (/api/v1/stores).
Provides secure CRUD endpoints for merchant onboarding, WhatsApp credential updates,
custom prompt configuration, and bot status toggles protected by JWT User Authentication.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.store import Store
from app.models.user import User
from app.schemas.store import StoreCreate, StoreUpdate, StoreResponse

router = APIRouter()


def _get_user_store_or_404(store_id: str, db: Session, current_user: User) -> Store:
    """Helper to resolve Store model by UUID string and verify ownership."""
    try:
        parsed_id = uuid.UUID(str(store_id))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid store ID format '{store_id}'. Must be a valid UUID.",
        )

    store = (
        db.query(Store)
        .filter(
            Store.id == parsed_id,
            or_(Store.owner_id == current_user.id, Store.owner_email == current_user.email),
        )
        .first()
    )
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with ID '{store_id}' not found or access denied.",
        )
    return store


@router.post(
    "",
    response_model=StoreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Onboard a new merchant store tenant",
)
def create_store(
    payload: StoreCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Onboard a new store tenant for the authenticated user:
    - Verifies WhatsApp Phone Number ID uniqueness.
    - Sets owner_id and owner_email from authenticated user.
    - Saves store credentials and custom AI prompt instructions.
    - Returns 201 Created with masked credentials.
    """
    clean_phone_id = str(payload.whatsapp_phone_number_id).strip()

    # Check for duplicate phone number ID across the platform
    existing = db.query(Store).filter(Store.whatsapp_phone_number_id == clean_phone_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Store with WhatsApp Phone Number ID '{clean_phone_id}' is already registered (Store ID: {existing.id}).",
        )

    new_store = Store(
        id=uuid.uuid4(),
        owner_id=current_user.id,
        name=payload.name.strip(),
        owner_email=current_user.email,
        whatsapp_phone_number_id=clean_phone_id,
        whatsapp_access_token=payload.whatsapp_access_token.strip(),
        system_prompt=payload.system_prompt,
        is_active=True,
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)

    return new_store


@router.get(
    "",
    response_model=List[StoreResponse],
    summary="List all merchant store tenants owned by current user",
)
def list_stores(
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(50, ge=1, le=200, description="Pagination page limit"),
    is_active: Optional[bool] = Query(None, description="Filter by active/inactive status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List all store tenants owned by the authenticated merchant with optional pagination and active-status filtering.
    """
    query = db.query(Store).filter(
        or_(Store.owner_id == current_user.id, Store.owner_email == current_user.email)
    )
    if is_active is not None:
        query = query.filter(Store.is_active == is_active)

    stores = query.order_by(Store.created_at.desc()).offset(skip).limit(limit).all()
    return stores


@router.get(
    "/{store_id}",
    response_model=StoreResponse,
    summary="Get details of a specific store tenant",
)
def get_store(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve specific store details by UUID (restricted to store owner).
    """
    return _get_user_store_or_404(store_id, db, current_user)


@router.patch(
    "/{store_id}",
    response_model=StoreResponse,
    summary="Update a store tenant configuration",
)
def update_store(
    store_id: str,
    payload: StoreUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update store name, AI system prompt, WhatsApp token, or active status (restricted to store owner).
    """
    store = _get_user_store_or_404(store_id, db, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return store

    if "name" in update_data and update_data["name"] is not None:
        store.name = update_data["name"].strip()
    if "system_prompt" in update_data and update_data["system_prompt"] is not None:
        store.system_prompt = update_data["system_prompt"]
    if "whatsapp_access_token" in update_data and update_data["whatsapp_access_token"] is not None:
        store.whatsapp_access_token = update_data["whatsapp_access_token"].strip()
    if "is_active" in update_data and update_data["is_active"] is not None:
        store.is_active = update_data["is_active"]

    store.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(store)

    return store


@router.delete(
    "/{store_id}",
    summary="Deactivate (soft delete) a store tenant",
)
def delete_store(
    store_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Soft deletes / deactivates a store tenant by setting `is_active = False` (restricted to store owner).
    """
    store = _get_user_store_or_404(store_id, db, current_user)
    store.is_active = False
    store.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "message": f"Store '{store.name}' ({store_id}) deactivated successfully.",
        "store_id": str(store.id),
        "is_active": False,
    }
