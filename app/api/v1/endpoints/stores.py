"""
Store Onboarding, Tenant Management, CSV Ingestion, and WhatsApp Verification Endpoints (/api/v1/stores).
Provides secure CRUD endpoints, bulk CSV product catalog ingestion, template download,
and Meta WhatsApp Cloud API connectivity verification protected by JWT User Authentication.
"""

import io
import csv
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.store import Store
from app.models.product import Product
from app.models.user import User
from app.schemas.store import (
    StoreCreate,
    StoreUpdate,
    StoreResponse,
    WhatsAppVerifyRequest,
    CSVImportSummary,
)

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


def _generate_product_size_variants(category: str, total_stock: int) -> List[Dict[str, Any]]:
    """Generate realistic size/option variants based on product category and stock."""
    cat_lower = (category or "").lower()
    if any(c in cat_lower for c in ["shirt", "top", "dress", "hoodie", "apparel", "clothing", "womens", "mens"]):
        sizes = ["XS", "S", "M", "L", "XL"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        return [{"size": s, "stock": max(base_stock + (remainder if i == 0 else 0), 0)} for i, s in enumerate(sizes)]
    elif any(c in cat_lower for c in ["shoe", "sneaker", "footwear", "boots"]):
        sizes = ["8", "9", "10", "11", "12"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        return [{"size": s, "stock": max(base_stock + (remainder if i == 0 else 0), 0)} for i, s in enumerate(sizes)]
    elif any(c in cat_lower for c in ["fragrance", "beauty", "skin-care", "perfume"]):
        sizes = ["30ml", "50ml", "100ml"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        return [{"size": s, "stock": max(base_stock + (remainder if i == 0 else 0), 0)} for i, s in enumerate(sizes)]
    else:
        return [{"size": "Standard", "stock": max(total_stock, 0)}]


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
    "/sample-products-csv",
    summary="Download sample product CSV ingestion template",
)
def download_sample_products_csv():
    """
    Returns a downloadable CSV template pre-populated with sample catalog items.
    """
    sample_csv_content = (
        "sku,title,price,stock_quantity,category,description\n"
        "TSHIRT-WHT-001,Classic Heavyweight Cotton T-Shirt,24.99,150,Apparel,Premium combed cotton relaxed fit t-shirt.\n"
        "HOODIE-BLK-002,Organic Fleece Pullover Hoodie,59.99,85,Apparel,Heavyweight fleece hoodie with kangaroo pocket.\n"
        "SNEAKER-RUN-003,Velocity Cloud Pro Running Shoes,129.99,40,Footwear,Breathable engineered mesh with responsive cushioning.\n"
        "PERFUME-OUD-004,Royal Amber & Oud Eau De Parfum,89.50,60,Fragrance,Luxury long-lasting oriental fragrance 50ml.\n"
        "LEATHER-WLT-005,Minimalist Bi-Fold Leather Wallet,34.00,110,Accessories,Full grain Italian leather with RFID protection.\n"
    )

    return Response(
        content=sample_csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=sample_products_template.csv"
        },
    )


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


@router.post(
    "/{store_id}/products/upload-csv",
    response_model=CSVImportSummary,
    summary="Bulk upload and ingest products from CSV file into store catalog",
)
async def upload_products_csv(
    store_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload and parse a CSV file of products into the merchant's store catalog:
    - Expected headers: title, price, stock_quantity, category, sku, description
    - Generates realistic size variants and unique SKU identifiers
    - Returns summary with imported count and non-fatal row errors
    """
    store = _get_user_store_or_404(store_id, db, current_user)

    if not file.filename.lower().endswith(".csv") and not (file.content_type and "csv" in file.content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid .csv spreadsheet.",
        )

    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty.",
        )

    # Decode handling BOM & various encodings
    try:
        text_content = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text_content = content_bytes.decode("latin-1")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not decode CSV file: {str(e)}",
            )

    csv_file = io.StringIO(text_content)
    reader = csv.DictReader(csv_file)

    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no header columns.",
        )

    # Normalize header mapping
    header_map = {}
    for h in reader.fieldnames:
        if h:
            norm = h.strip().lower().replace(" ", "_")
            header_map[norm] = h

    # Check for required title & price headers
    has_title = any(k in header_map for k in ["title", "name", "product_name"])
    has_price = "price" in header_map
    if not has_title or not has_price:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must contain at least 'title' (or 'name') and 'price' columns.",
        )

    total_rows = 0
    new_products: List[Product] = []
    errors: List[str] = []

    for row_idx, raw_row in enumerate(reader, start=2):
        # Ignore completely empty rows
        if not any(v.strip() for v in raw_row.values() if isinstance(v, str)):
            continue

        total_rows += 1
        row = {k.strip().lower().replace(" ", "_"): (v or "").strip() for k, v in raw_row.items() if k}

        # 1. Extract Title
        title_val = row.get("title") or row.get("name") or row.get("product_name") or ""
        if not title_val:
            errors.append(f"Row {row_idx}: Missing product title/name.")
            continue

        # 2. Extract Price
        price_raw = row.get("price", "").replace("$", "").replace(",", "").strip()
        try:
            price_val = float(price_raw)
            if price_val < 0:
                errors.append(f"Row {row_idx}: Price cannot be negative.")
                continue
        except (ValueError, TypeError):
            errors.append(f"Row {row_idx}: Invalid price value '{price_raw}'.")
            continue

        # 3. Extract Stock Quantity
        stock_raw = row.get("stock_quantity") or row.get("stock") or row.get("quantity") or row.get("qty") or "0"
        try:
            stock_val = int(float(stock_raw.replace(",", "").strip()))
            if stock_val < 0:
                stock_val = 0
        except (ValueError, TypeError):
            stock_val = 0

        # 4. Extract Category & Description
        category_val = row.get("category") or "General"
        desc_val = row.get("description") or None
        image_val = row.get("image_url") or row.get("image") or None

        # 5. Extract or Generate SKU
        sku_val = row.get("sku") or ""
        if not sku_val:
            sku_val = f"SKU-{str(store.id)[:4].upper()}-{uuid.uuid4().hex[:6].upper()}"

        # Ensure SKU uniqueness in DB
        existing_sku = db.query(Product).filter(Product.sku == sku_val).first()
        if existing_sku:
            sku_val = f"{sku_val}-{uuid.uuid4().hex[:4].upper()}"

        # 6. Generate size variants
        variants = _generate_product_size_variants(category_val, stock_val)

        product = Product(
            store_id=store.id,
            sku=sku_val,
            title=title_val,
            price=price_val,
            stock_quantity=stock_val,
            category=category_val,
            description=desc_val,
            image_url=image_val,
            size_variants=variants,
            rating=4.5,
        )
        new_products.append(product)

    if new_products:
        db.add_all(new_products)
        db.commit()

    return CSVImportSummary(
        total_rows=total_rows,
        imported=len(new_products),
        errors=errors,
        sample_imported=[p.to_dict() for p in new_products[:5]],
    )


@router.post(
    "/{store_id}/verify-whatsapp",
    summary="Verify WhatsApp Cloud API connection and token validity with Meta",
)
async def verify_whatsapp_connection(
    store_id: str,
    payload: Optional[WhatsAppVerifyRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify WhatsApp Cloud API connection against Meta Graph API:
    - Tests phone_number_id and access_token.
    - If valid: returns connected status and verified business profile name.
    - If invalid: returns failed status with Meta error details.
    """
    store = _get_user_store_or_404(store_id, db, current_user)

    phone_id = (
        payload.whatsapp_phone_number_id.strip()
        if payload and payload.whatsapp_phone_number_id
        else (store.whatsapp_phone_number_id or "").strip()
    )
    access_token = (
        payload.whatsapp_access_token.strip()
        if payload and payload.whatsapp_access_token
        else (store.whatsapp_access_token or "").strip()
    )

    if not phone_id or not access_token:
        return {
            "status": "failed",
            "error": "Both WhatsApp Phone Number ID and Access Token are required for verification.",
        }

    meta_url = f"https://graph.facebook.com/v21.0/{phone_id}"
    params = {
        "access_token": access_token,
        "fields": "verified_name,display_phone_number,quality_rating,code_verification_status",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as http_client:
            response = await http_client.get(meta_url, params=params)

        if response.status_code == 200:
            meta_data = response.json()
            # If fresh credentials provided, check uniqueness and save to store
            if payload and payload.whatsapp_phone_number_id:
                new_phone_id = payload.whatsapp_phone_number_id.strip()
                if new_phone_id != store.whatsapp_phone_number_id:
                    existing_store = (
                        db.query(Store)
                        .filter(Store.whatsapp_phone_number_id == new_phone_id)
                        .first()
                    )
                    if existing_store and existing_store.id != store.id:
                        return {
                            "status": "failed",
                            "error": f"WhatsApp Phone Number ID '{new_phone_id}' is already connected to another store tenant.",
                        }
                    store.whatsapp_phone_number_id = new_phone_id

            if payload and payload.whatsapp_access_token:
                store.whatsapp_access_token = payload.whatsapp_access_token.strip()

            store.updated_at = datetime.now(timezone.utc)
            db.commit()

            return {
                "status": "connected",
                "verified_name": meta_data.get("verified_name") or store.name,
                "display_phone_number": meta_data.get("display_phone_number") or phone_id,
                "quality_rating": meta_data.get("quality_rating"),
                "details": meta_data,
            }
        else:
            try:
                err_body = response.json()
            except Exception:
                err_body = response.text

            return {
                "status": "failed",
                "error": "Invalid Meta credentials or expired token",
                "status_code": response.status_code,
                "details": err_body,
            }

    except Exception as e:
        return {
            "status": "failed",
            "error": f"Failed to connect to Meta Graph API: {str(e)}",
        }
