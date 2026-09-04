"""
Supabase Client and Direct Database Tool Operations for Gemini AI Function Calling.
Provides tool functions for querying orders and product inventory in Supabase PostgreSQL tables.
"""

import os
import re
import logging
from typing import Optional, Dict, Any, Union
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """
    Initialize and return a Supabase Client singleton using environment credentials.
    Reads SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = (
        getattr(settings, "SUPABASE_URL", "")
        or os.environ.get("SUPABASE_URL", "")
    )
    key = (
        getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "")
        or getattr(settings, "SUPABASE_KEY", "")
        or getattr(settings, "SUPABASE_ANON_KEY", "")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.environ.get("SUPABASE_KEY", "")
        or os.environ.get("SUPABASE_ANON_KEY", "")
    )

    # Fallback to demo public/anon token or standard Supabase project URL if not provided
    if not url or url.startswith("your_"):
        url = "https://wmkhqqbpcppnekuzrpyb.supabase.co"

    if not key or key.startswith("your_"):
        # Without key, client cannot be initialized
        logger.warning("Supabase API Key (SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY) is not set.")
        return None

    try:
        _supabase_client = create_client(url, key)
        logger.info(f"✅ Supabase client initialized for project: {url}")
        return _supabase_client
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase client: {e}", exc_info=True)
        return None


def track_order(order_id: str, client: Optional[Any] = None) -> Dict[str, Any]:
    """
    Queries the orders table in Supabase:
    supabase.table("orders").select("id, status, tracking_number, courier, created_at, items").eq("id", order_id).execute()

    Args:
        order_id: The unique identifier of the order to track (e.g. '1042', '#1043').
        client: Optional Supabase client instance (used for testing/mocking).

    Returns:
        dict: Order data dictionary or a clear {"error": "Order not found"} message.
    """
    if not order_id or not str(order_id).strip():
        return {"error": "Order not found"}

    clean_id = str(order_id).strip().lstrip("#")

    try:
        supabase = client if client is not None else get_supabase_client()
        if supabase is None:
            # Fallback to local ecommerce_service if Supabase client is unconfigured
            try:
                from app.services.ecommerce_service import ecommerce_service
                res = ecommerce_service.get_order_by_number(clean_id)
                if res.get("success"):
                    return {
                        "id": res.get("order_id"),
                        "status": res.get("status"),
                        "tracking_number": res.get("tracking_number"),
                        "courier": res.get("carrier"),
                        "created_at": res.get("order_date"),
                        "items": res.get("items", []),
                    }
            except Exception:
                pass
            return {"error": "Order not found"}

        # 1. Primary query as specified
        res = (
            supabase.table("orders")
            .select("id, status, tracking_number, courier, created_at, items")
            .eq("id", clean_id)
            .execute()
        )

        data = getattr(res, "data", None)
        if data and isinstance(data, list) and len(data) > 0:
            return data[0]

        # 2. Resilient check against order_number field if human-readable order number was provided
        try:
            res_ord = (
                supabase.table("orders")
                .select("id, status, tracking_number, courier, created_at, items")
                .eq("order_number", clean_id)
                .execute()
            )
            data_ord = getattr(res_ord, "data", None)
            if data_ord and isinstance(data_ord, list) and len(data_ord) > 0:
                return data_ord[0]
        except Exception:
            pass

        return {"error": "Order not found"}

    except Exception as e:
        logger.error(f"❌ Error in track_order({order_id}): {e}", exc_info=True)
        return {"error": "Order not found"}


def check_product_stock(product_name: str, client: Optional[Any] = None) -> Dict[str, Any]:
    """
    Queries the products/inventory table in Supabase (using ilike for case-insensitive search):
    supabase.table("products").select("name, stock_quantity, price, in_stock").ilike("name", f"%{product_name}%").execute()

    Args:
        product_name: The name or keyword of the product to search for.
        client: Optional Supabase client instance (used for testing/mocking).

    Returns:
        dict: Matched products dictionary or {"error": "Product not found"}.
    """
    if not product_name or not str(product_name).strip():
        return {"error": "Product not found"}

    clean_name = str(product_name).strip()

    try:
        supabase = client if client is not None else get_supabase_client()
        if supabase is None:
            # Fallback to local ecommerce_service if Supabase client is unconfigured
            try:
                from app.services.ecommerce_service import ecommerce_service
                res = ecommerce_service.get_product_stock(clean_name)
                if res and res[0].get("success") is not False:
                    item = res[0]
                    return {
                        "name": item.get("product_name"),
                        "stock_quantity": item.get("stock_count", 0),
                        "price": item.get("price", 0.0),
                        "in_stock": item.get("in_stock", False),
                    }
            except Exception:
                pass
            return {"error": "Product not found"}

        # 1. Primary query as specified
        res = (
            supabase.table("products")
            .select("name, stock_quantity, price, in_stock")
            .ilike("name", f"%{clean_name}%")
            .execute()
        )

        data = getattr(res, "data", None)
        if data and isinstance(data, list) and len(data) > 0:
            if len(data) == 1:
                return data[0]
            return {"products": data, "count": len(data)}

        # 2. Resilient check against title column if name is stored under title
        try:
            res_title = (
                supabase.table("products")
                .select("name, stock_quantity, price, in_stock")
                .ilike("title", f"%{clean_name}%")
                .execute()
            )
            data_title = getattr(res_title, "data", None)
            if data_title and isinstance(data_title, list) and len(data_title) > 0:
                if len(data_title) == 1:
                    return data_title[0]
                return {"products": data_title, "count": len(data_title)}
        except Exception:
            pass

        return {"error": "Product not found"}

    except Exception as e:
        logger.error(f"❌ Error in check_product_stock({product_name}): {e}", exc_info=True)
        return {"error": "Product not found"}


def execute_supabase_tool(tool_name: str, arguments: Dict[str, Any], client: Optional[Any] = None) -> Dict[str, Any]:
    """
    Dispatcher to execute a Supabase tool function by name.
    """
    tool_map = {
        "track_order": track_order,
        "check_product_stock": check_product_stock,
    }
    if tool_name not in tool_map:
        return {"error": f"Tool '{tool_name}' is not recognized."}

    if tool_name == "track_order":
        func = track_order
    elif tool_name == "check_product_stock":
        func = check_product_stock
    else:
        return {"error": f"Tool '{tool_name}' is not recognized."}

    try:
        if client is not None:
            return func(client=client, **arguments)
        return func(**arguments)
    except Exception as e:
        logger.error(f"❌ Exception executing {tool_name}: {e}", exc_info=True)
        return {"error": f"Error executing tool '{tool_name}': {str(e)}"}
