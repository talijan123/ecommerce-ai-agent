"""
Direct Database Tool Operations for Gemini AI Function Calling.
Uses the active SQLAlchemy PostgreSQL database engine and session from DATABASE_URL
to query 'orders' and 'products' tables directly.
"""

import re
import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import SessionLocal
from app.models.order import Order
from app.models.product import Product

logger = logging.getLogger(__name__)


def track_order(
    order_id: str,
    store_id: Optional[Any] = None,
    db: Optional[Session] = None,
    client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Queries the orders table directly in the database to track an order's status,
    tracking number, courier/carrier, created date, and items.
    Scoped by tenant store_id if provided.

    Args:
        order_id: The unique identifier or order number of the order to track (e.g. '1042', '#1043').
        store_id: Optional tenant Store ID (UUID or str) to partition query.
        db: Optional active SQLAlchemy session. If None, opens and manages a SessionLocal session.
        client: Optional compatibility parameter for mock sessions in tests.

    Returns:
        dict: Order data dictionary or a clear {"error": "Order not found"} message.
    """
    if not order_id or not str(order_id).strip():
        return {"error": "Order not found"}

    clean_id = str(order_id).strip().lstrip("#")
    
    session = db or client
    owns_session = False
    if session is None:
        session = SessionLocal()
        owns_session = True

    try:
        filters = [
            Order.order_number == clean_id,
            Order.order_number.ilike(f"#{clean_id}"),
            Order.order_number.ilike(clean_id),
        ]
        if clean_id.isdigit():
            try:
                filters.append(Order.id == int(clean_id))
            except Exception:
                pass

        query = session.query(Order).filter(or_(*filters))
        if store_id is not None:
            query = query.filter(Order.store_id == store_id)

        order = query.first()

        if not order:
            return {"error": "Order not found"}

        return {
            "id": getattr(order, "id", None),
            "store_id": str(order.store_id) if getattr(order, "store_id", None) else None,
            "order_number": getattr(order, "order_number", clean_id),
            "status": getattr(order, "status", "Processing"),
            "tracking_number": getattr(order, "tracking_number", None),
            "courier": getattr(order, "carrier", None) or getattr(order, "courier", None),
            "created_at": order.created_at.isoformat() if getattr(order, "created_at", None) and hasattr(order.created_at, "isoformat") else str(getattr(order, "created_at", "")),
            "items": getattr(order, "items", []) or [],
        }

    except Exception as e:
        logger.error(f"❌ Error querying order '{order_id}' from database: {e}", exc_info=True)
        return {"error": "Order not found"}
    finally:
        if owns_session:
            session.close()


def check_product_stock(
    product_name: str,
    store_id: Optional[Any] = None,
    db: Optional[Session] = None,
    client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Queries the products table in the database directly (using case-insensitive matching)
    for stock quantity, price, and in-stock availability.
    Scoped by tenant store_id if provided.

    Args:
        product_name: The name or keyword of the product to search for.
        store_id: Optional tenant Store ID (UUID or str) to partition query.
        db: Optional active SQLAlchemy session. If None, opens and manages a SessionLocal session.
        client: Optional compatibility parameter for mock sessions in tests.

    Returns:
        dict: Matched product data dictionary or {"error": "Product not found"}.
    """
    if not product_name or not str(product_name).strip():
        return {"error": "Product not found"}

    clean_name = str(product_name).strip()

    session = db or client
    owns_session = False
    if session is None:
        session = SessionLocal()
        owns_session = True

    try:
        query = (
            session.query(Product)
            .filter(
                or_(
                    Product.title.ilike(f"%{clean_name}%"),
                    Product.sku.ilike(f"%{clean_name}%"),
                    Product.category.ilike(f"%{clean_name}%"),
                )
            )
        )
        if store_id is not None:
            query = query.filter(Product.store_id == store_id)

        products = query.all()

        if not products:
            return {"error": "Product not found"}

        items = [
            {
                "id": getattr(p, "id", None),
                "store_id": str(p.store_id) if getattr(p, "store_id", None) else None,
                "name": getattr(p, "title", clean_name),
                "stock_quantity": getattr(p, "stock_quantity", 0),
                "price": getattr(p, "price", 0.0),
                "in_stock": getattr(p, "stock_quantity", 0) > 0,
                "category": getattr(p, "category", None),
            }
            for p in products
        ]

        if len(items) == 1:
            return items[0]
        return {"products": items, "count": len(items)}

    except Exception as e:
        logger.error(f"❌ Error querying product stock for '{product_name}' from database: {e}", exc_info=True)
        return {"error": "Product not found"}
    finally:
        if owns_session:
            session.close()


DB_TOOL_MAP = {
    "track_order": track_order,
    "check_product_stock": check_product_stock,
}


def execute_db_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    store_id: Optional[Any] = None,
    db: Optional[Session] = None,
    client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Dispatcher to execute a database tool function by name with optional store_id scoping.
    """
    if tool_name == "track_order":
        func = track_order
    elif tool_name == "check_product_stock":
        func = check_product_stock
    else:
        return {"error": f"Tool '{tool_name}' is not recognized."}

    # Pass store_id if supported by function and not already specified
    call_args = dict(arguments)
    if store_id is not None and "store_id" not in call_args:
        call_args["store_id"] = store_id

    session = db or client
    try:
        if session is not None:
            return func(db=session, **call_args)
        return func(**call_args)
    except Exception as e:
        logger.error(f"❌ Exception executing DB tool {tool_name}: {e}", exc_info=True)
        return {"error": f"Error executing tool '{tool_name}': {str(e)}"}


# Aliases for backward compatibility
execute_supabase_tool = execute_db_tool
