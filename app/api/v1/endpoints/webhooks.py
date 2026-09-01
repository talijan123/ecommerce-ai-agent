"""
Webhooks Endpoints: Ingestion endpoints for e-commerce platforms (Shopify, WooCommerce, Custom).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.order import Order
from app.models.product import Product
from app.schemas.webhook import OrderWebhookPayload, InventoryWebhookPayload, WebhookResponse

router = APIRouter()


@router.post(
    "/webhooks/orders/create",
    response_model=WebhookResponse,
    summary="Webhook: New Order Ingestion",
    description="Receives real-time order creation webhooks from Shopify, WooCommerce, or storefronts."
)
def handle_order_created_webhook(
    payload: OrderWebhookPayload,
    db: Session = Depends(get_db),
):
    """
    Ingests an incoming order and creates/updates records in the database.
    """
    # Check if order already exists
    existing = db.query(Order).filter(Order.order_number == payload.order_number).first()
    if existing:
        return WebhookResponse(
            success=True,
            message=f"Order {payload.order_number} already exists in database.",
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

    # Determine status
    status_str = "Processing"
    if payload.fulfillment_status == "fulfilled":
        status_str = "Shipped"

    # Map items
    items_list = []
    for item in payload.line_items:
        items_list.append({
            "name": item.get("title") or item.get("name", "Product"),
            "size": item.get("variant_title") or item.get("size"),
            "quantity": item.get("quantity", 1),
            "price": float(item.get("price", 0.0)),
        })

    new_order = Order(
        order_number=payload.order_number,
        customer_name=payload.customer_name or "Customer",
        customer_email=payload.email,
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
    )


@router.post(
    "/webhooks/inventory/update",
    response_model=WebhookResponse,
    summary="Webhook: Inventory Level Sync",
    description="Synchronizes product stock levels and variant counts from ERP / inventory management."
)
def handle_inventory_update_webhook(
    payload: InventoryWebhookPayload,
    db: Session = Depends(get_db),
):
    """
    Updates the stock count for a specific product or variant SKU.
    """
    product = db.query(Product).filter(Product.sku.ilike(payload.sku)).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with SKU '{payload.sku}' not found."
        )

    # Update size variant if size specified
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
