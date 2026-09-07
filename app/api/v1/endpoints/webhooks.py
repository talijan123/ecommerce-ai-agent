import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.store import Store
from app.models.order import Order
from app.models.cart import CartSession
from app.models.product import Product
from app.schemas.webhook import (
    OrderWebhookPayload,
    CartWebhookPayload,
    InventoryWebhookPayload,
    WebhookResponse,
)
from app.services.whatsapp_service import whatsapp_service

router = APIRouter()


def _resolve_store(store_id_str: str, db: Session) -> Store:
    try:
        store_uuid = uuid.UUID(str(store_id_str).strip())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid store ID format '{store_id_str}'. Must be a valid UUID.",
        )
    store = db.query(Store).filter(Store.id == store_uuid).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store '{store_id_str}' not found.",
        )
    return store


def _ingest_cart_webhook(store: Store, payload: CartWebhookPayload, platform: str, db: Session) -> WebhookResponse:
    raw_session = payload.session_id or payload.token or payload.cart_token or payload.id or f"{platform[:2]}_cart_{uuid.uuid4().hex[:10]}"
    session_id = str(raw_session).strip()

    name = payload.customer_name or f"{payload.first_name or ''} {payload.last_name or ''}".strip() or "Valued Customer"
    email = payload.customer_email or payload.email or f"customer_{session_id[:8]}@example.com"
    phone = payload.customer_phone or payload.phone
    checkout_url = payload.abandoned_checkout_url or payload.checkout_url or payload.cart_url

    raw_items = payload.line_items or payload.items or []
    formatted_items = []
    for it in raw_items:
        formatted_items.append({
            "name": it.get("title") or it.get("name", "Product"),
            "title": it.get("title") or it.get("name", "Product"),
            "price": float(it.get("price", 0.0) or 0.0),
            "quantity": int(it.get("quantity", 1) or 1),
            "size": it.get("variant_title") or it.get("size") or "Standard",
            "image": it.get("image_url") or it.get("image") or (it.get("images", [{}])[0].get("src") if isinstance(it.get("images"), list) and len(it.get("images")) > 0 else None),
        })

    cart = (
        db.query(CartSession)
        .filter(
            CartSession.store_id == store.id,
            CartSession.session_id == session_id,
        )
        .first()
    )

    if not cart:
        cart = CartSession(
            store_id=store.id,
            session_id=session_id,
            customer_email=email,
            customer_name=name,
            customer_phone=phone,
            abandoned_items=formatted_items,
            checkout_url=checkout_url,
            status="pending",
            discount_code="RECOVER10",
            discount_percentage=10,
            abandoned_at=datetime.now(timezone.utc),
        )
        db.add(cart)
    else:
        cart.customer_name = name
        cart.customer_email = email
        if phone:
            cart.customer_phone = phone
        cart.abandoned_items = formatted_items
        if checkout_url:
            cart.checkout_url = checkout_url
        cart.status = "pending"
        cart.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(cart)

    return WebhookResponse(
        success=True,
        message=f"Abandoned cart '{session_id}' successfully tracked for store '{store.name}'.",
        processed_at=datetime.now(timezone.utc).isoformat(),
        data=cart.to_dict(),
    )


def _ingest_order_webhook(store: Store, payload: OrderWebhookPayload, platform: str, db: Session) -> WebhookResponse:
    order_num = str(payload.order_number).strip()
    phone = payload.customer_phone or payload.phone

    # Status determination
    status_str = "Processing"
    if payload.fulfillment_status == "fulfilled" or payload.status in ("Shipped", "shipped", "fulfilled"):
        status_str = "Shipped"
    elif payload.status in ("Cancelled", "cancelled"):
        status_str = "Cancelled"
    elif payload.status in ("Delivered", "delivered"):
        status_str = "Delivered"

    # Line items normalization
    items_list = []
    for item in payload.line_items:
        items_list.append({
            "name": item.get("title") or item.get("name", "Product"),
            "size": item.get("variant_title") or item.get("size"),
            "quantity": item.get("quantity", 1),
            "price": float(item.get("price", 0.0) or 0.0),
        })

    order = (
        db.query(Order)
        .filter(
            Order.store_id == store.id,
            Order.order_number == order_num,
        )
        .first()
    )

    is_new = order is None
    prev_status = order.status if order else None

    if is_new:
        order = Order(
            store_id=store.id,
            order_number=order_num,
            customer_name=payload.customer_name or "Customer",
            customer_email=payload.email or f"order_{order_num}@example.com",
            customer_phone=phone,
            status=status_str,
            carrier=payload.carrier,
            tracking_number=payload.tracking_number,
            tracking_url=payload.tracking_url,
            items=items_list,
            total_amount=payload.total_price,
            shipping_address=str(payload.shipping_address) if payload.shipping_address else None,
        )
        db.add(order)
    else:
        order.status = status_str
        if phone:
            order.customer_phone = phone
        if payload.carrier:
            order.carrier = payload.carrier
        if payload.tracking_number:
            order.tracking_number = payload.tracking_number
        if payload.tracking_url:
            order.tracking_url = payload.tracking_url
        if items_list:
            order.items = items_list
        if payload.total_price:
            order.total_amount = payload.total_price

    db.commit()
    db.refresh(order)

    # Automated Outbound WhatsApp Notifications
    if phone:
        token = store.whatsapp_access_token
        phone_id = store.whatsapp_phone_number_id
        customer_name = order.customer_name or "there"

        # 1. Order Confirmation Alert
        if is_new or (prev_status != "Processing" and status_str == "Processing"):
            confirm_msg = f"Hi {customer_name}! Your order #{order_num} has been confirmed. We are preparing your parcel. 📦"
            whatsapp_service.send_text_message_sync(
                to_phone_number=phone,
                message_text=confirm_msg,
                token=token,
                phone_number_id=phone_id,
            )

        # 2. Shipping & Tracking Alert
        if status_str == "Shipped" and (is_new or prev_status != "Shipped"):
            carrier_name = order.carrier or "our courier partner"
            trk = order.tracking_number or "N/A"
            trk_url = order.tracking_url or ""
            ship_msg = f"Hi {customer_name}! Great news! Your order #{order_num} has been shipped via {carrier_name}. Tracking Number: {trk}. Track here: {trk_url} 🚀"
            whatsapp_service.send_text_message_sync(
                to_phone_number=phone,
                message_text=ship_msg,
                token=token,
                phone_number_id=phone_id,
            )

        # 3. Mark matching cart session recovered
        cart = (
            db.query(CartSession)
            .filter(
                CartSession.store_id == store.id,
                or_(
                    CartSession.customer_phone == phone,
                    CartSession.customer_email == order.customer_email,
                ),
                CartSession.is_recovered == False,
            )
            .order_by(CartSession.created_at.desc())
            .first()
        )
        if cart:
            cart.is_recovered = True
            cart.status = "recovered"
            db.commit()

    return WebhookResponse(
        success=True,
        message=f"Order '{order_num}' successfully processed for store '{store.name}'. Status: {status_str}",
        processed_at=datetime.now(timezone.utc).isoformat(),
        data=order.to_dict(),
    )


# -------------------------------------------------------------------------
# Phase 1: Cart Abandonment Webhook Endpoints
# -------------------------------------------------------------------------

@router.post(
    "/webhooks/shopify/{store_id}/checkouts",
    response_model=WebhookResponse,
    summary="Shopify Abandoned Checkout Webhook",
    description="Ingests abandoned checkout payloads from Shopify stores scoped to tenant store_id.",
)
def handle_shopify_checkout_webhook(
    store_id: str,
    payload: CartWebhookPayload,
    db: Session = Depends(get_db),
):
    store = _resolve_store(store_id, db)
    return _ingest_cart_webhook(store, payload, "shopify", db)


@router.post(
    "/webhooks/woocommerce/{store_id}/cart",
    response_model=WebhookResponse,
    summary="WooCommerce Abandoned Cart Webhook",
    description="Ingests abandoned cart payloads from WooCommerce stores scoped to tenant store_id.",
)
def handle_woocommerce_cart_webhook(
    store_id: str,
    payload: CartWebhookPayload,
    db: Session = Depends(get_db),
):
    store = _resolve_store(store_id, db)
    return _ingest_cart_webhook(store, payload, "woocommerce", db)


# -------------------------------------------------------------------------
# Phase 3: Post-Purchase Order Webhook Endpoints
# -------------------------------------------------------------------------

@router.post(
    "/webhooks/shopify/{store_id}/orders",
    response_model=WebhookResponse,
    summary="Shopify Order Ingestion & Fulfillment Webhook",
    description="Ingests order creation and status updates from Shopify with automated WhatsApp notifications.",
)
def handle_shopify_order_webhook(
    store_id: str,
    payload: OrderWebhookPayload,
    db: Session = Depends(get_db),
):
    store = _resolve_store(store_id, db)
    return _ingest_order_webhook(store, payload, "shopify", db)


@router.post(
    "/webhooks/woocommerce/{store_id}/orders",
    response_model=WebhookResponse,
    summary="WooCommerce Order Ingestion & Fulfillment Webhook",
    description="Ingests order creation and status updates from WooCommerce with automated WhatsApp notifications.",
)
def handle_woocommerce_order_webhook(
    store_id: str,
    payload: OrderWebhookPayload,
    db: Session = Depends(get_db),
):
    store = _resolve_store(store_id, db)
    return _ingest_order_webhook(store, payload, "woocommerce", db)


# -------------------------------------------------------------------------
# Generic/Legacy Webhook Endpoints (Backward Compatibility)
# -------------------------------------------------------------------------

@router.post(
    "/webhooks/orders/create",
    response_model=WebhookResponse,
    summary="Webhook: Generic New Order Ingestion",
    description="Receives real-time order creation webhooks from Shopify, WooCommerce, or storefronts.",
)
def handle_order_created_webhook(
    payload: OrderWebhookPayload,
    db: Session = Depends(get_db),
):
    existing = db.query(Order).filter(Order.order_number == payload.order_number).first()
    if existing:
        return WebhookResponse(
            success=True,
            message=f"Order {payload.order_number} already exists in database.",
            processed_at=datetime.now(timezone.utc).isoformat(),
            data=existing.to_dict(),
        )

    status_str = "Processing"
    if payload.fulfillment_status == "fulfilled" or payload.status == "Shipped":
        status_str = "Shipped"

    items_list = []
    for item in payload.line_items:
        items_list.append({
            "name": item.get("title") or item.get("name", "Product"),
            "size": item.get("variant_title") or item.get("size"),
            "quantity": item.get("quantity", 1),
            "price": float(item.get("price", 0.0) or 0.0),
        })

    new_order = Order(
        order_number=payload.order_number,
        customer_name=payload.customer_name or "Customer",
        customer_email=payload.email or f"order_{payload.order_number}@example.com",
        customer_phone=payload.customer_phone or payload.phone,
        status=status_str,
        carrier=payload.carrier,
        tracking_number=payload.tracking_number,
        tracking_url=payload.tracking_url,
        items=items_list,
        total_amount=payload.total_price,
        shipping_address=str(payload.shipping_address) if payload.shipping_address else None,
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return WebhookResponse(
        success=True,
        message=f"Order {payload.order_number} successfully ingested into database.",
        processed_at=datetime.now(timezone.utc).isoformat(),
        data=new_order.to_dict(),
    )


@router.post(
    "/webhooks/inventory/update",
    response_model=WebhookResponse,
    summary="Webhook: Inventory Level Sync",
    description="Synchronizes product stock levels and variant counts from ERP / inventory management.",
)
def handle_inventory_update_webhook(
    payload: InventoryWebhookPayload,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.sku.ilike(payload.sku)).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU '{payload.sku}' not found.",
        )

    if payload.size and product.size_variants:
        updated_variants = []
        for v in product.size_variants:
            if str(v.get("size", "")).upper() == payload.size.upper():
                updated_variants.append({"size": v["size"], "stock": payload.available})
            else:
                updated_variants.append(v)
        product.size_variants = updated_variants
        product.stock_quantity = sum(v.get("stock", 0) for v in updated_variants)
    else:
        product.stock_quantity = payload.available

    db.commit()

    return WebhookResponse(
        success=True,
        message=f"Inventory for SKU {payload.sku} updated to {payload.available}.",
        processed_at=datetime.now(timezone.utc).isoformat(),
    )

