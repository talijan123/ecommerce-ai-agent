"""
Store Onboarding and Multi-Tenant Management Endpoints (/api/v1/stores).
Provides CRUD endpoints for merchant onboarding, WhatsApp credential updates,
custom prompt configuration, and bot status toggles.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.store import Store
from app.schemas.store import StoreCreate, StoreUpdate, StoreResponse

router = APIRouter()


def _get_store_or_404(store_id: str, db: Session) -> Store:
    """Helper to resolve Store model by UUID string or 404."""
    try:
        parsed_id = uuid.UUID(str(store_id))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invalid store ID format '{store_id}'. Must be a valid UUID.",
        )

    store = db.query(Store).filter(Store.id == parsed_id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with ID '{store_id}' not found.",
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
    db: Session = Depends(get_db),
):
    """
    Onboard a new store tenant:
    - Verifies WhatsApp Phone Number ID uniqueness.
    - Saves store credentials, owner email, and custom AI prompt instructions.
    - Returns 201 Created with masked credentials.
    """
    clean_phone_id = str(payload.whatsapp_phone_number_id).strip()

    # Check for duplicate phone number ID
    existing = db.query(Store).filter(Store.whatsapp_phone_number_id == clean_phone_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Store with WhatsApp Phone Number ID '{clean_phone_id}' is already registered (Store ID: {existing.id}).",
        )

    new_store = Store(
        id=uuid.uuid4(),
        name=payload.name.strip(),
        owner_email=payload.owner_email.strip().lower(),
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
    summary="List all merchant store tenants",
)
def list_stores(
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(50, ge=1, le=200, description="Pagination page limit"),
    is_active: Optional[bool] = Query(None, description="Filter by active/inactive status"),
    db: Session = Depends(get_db),
):
    """
    List all store tenants with optional pagination and active-status filtering.
    """
    query = db.query(Store)
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
    db: Session = Depends(get_db),
):
    """
    Retrieve specific store details by UUID.
    """
    return _get_store_or_404(store_id, db)


@router.patch(
    "/{store_id}",
    response_model=StoreResponse,
    summary="Update a store tenant configuration",
)
def update_store(
    store_id: str,
    payload: StoreUpdate,
    db: Session = Depends(get_db),
):
    """
    Update store name, AI system prompt, WhatsApp token, or active status.
    """
    store = _get_store_or_404(store_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        return store

    if "name" in update_data and update_data["name"] is not None:
        store.name = update_data["name"].strip()
    if "owner_email" in update_data and update_data["owner_email"] is not None:
        store.owner_email = update_data["owner_email"].strip().lower()
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
    db: Session = Depends(get_db),
):
    """
    Soft deletes / deactivates a store tenant by setting `is_active = False`.
    """
    store = _get_store_or_404(store_id, db)
    store.is_active = False
    store.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "message": f"Store '{store.name}' ({store_id}) deactivated successfully.",
        "store_id": str(store.id),
        "is_active": False,
    }
