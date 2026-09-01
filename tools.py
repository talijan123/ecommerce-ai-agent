"""
Tool and Function Calling Layer for Autonomous E-Commerce AI Agent.
Defines Python tool functions with strict typing and docstrings, along with
their corresponding OpenAI Tool Schemas (tools / tool_calls format).
"""

import re
from typing import List, Dict, Any, Optional
from mock_data import PRODUCTS, ORDERS, CART_SESSIONS


def get_order_status(order_id: str) -> Dict[str, Any]:
    """
    Retrieve real-time status and shipping details for a customer order by its Order ID.

    Args:
        order_id: The unique identifier of the order (e.g., '1042', '#1043').

    Returns:
        A dictionary containing order status, items, carrier, tracking information,
        and estimated delivery date, or an error message if not found.
    """
    # Clean up order_id (remove '#' or common prefixes)
    cleaned_id = re.sub(r"[^\w-]", "", order_id).lstrip("#").strip()

    # Search for matching order
    for order in ORDERS:
        if order["order_id"].lower() == cleaned_id.lower():
            return {
                "success": True,
                "order_id": order["order_id"],
                "customer_name": order["customer_name"],
                "status": order["status"],
                "carrier": order.get("carrier"),
                "tracking_number": order.get("tracking_number"),
                "tracking_url": order.get("tracking_url"),
                "estimated_delivery": order.get("estimated_delivery"),
                "order_date": order.get("order_date"),
                "items": order.get("items", []),
                "total_amount": order.get("total_amount"),
                "shipping_address": order.get("shipping_address"),
                "cancellation_reason": order.get("cancellation_reason"),
            }

    return {
        "success": False,
        "error": f"Order ID '{order_id}' was not found in our database. Please verify the order number and try again.",
        "suggested_action": "Ask customer to verify their order number or the email associated with the order."
    }


def check_product_inventory(product_name: str, size: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Check stock availability, pricing, and details for a product by name and optional size variant.
    If the requested size is out of stock, provides available alternative sizes and related items.

    Args:
        product_name: The name or keyword of the product (e.g., 'Classic White T-Shirt', 'Headphones').
        size: Optional size/variant (e.g., 'S', 'M', 'L', 'XL', '32', '10').

    Returns:
        A list of matching product variant objects containing inventory count, price,
        availability status, and alternatives if out of stock.
    """
    query_lower = product_name.lower().strip()
    
    # Match products by name containing the query or category
    matching_products = [
        p for p in PRODUCTS
        if query_lower in p["name"].lower() or query_lower in p["category"].lower()
    ]

    if not matching_products:
        # Check token-based similarity if exact substring fails
        query_words = set(query_lower.split())
        matching_products = [
            p for p in PRODUCTS
            if any(word in p["name"].lower().split() for word in query_words)
        ]

    if not matching_products:
        return [{
            "success": False,
            "query": product_name,
            "message": f"No products found matching '{product_name}'.",
            "available_categories": list({p['category'] for p in PRODUCTS}),
        }]

    results: List[Dict[str, Any]] = []
    
    # If size is specified, check the specific size and list alternative sizes
    if size:
        cleaned_size = size.strip().upper()
        
        # Filter for requested size among matching products
        exact_size_matches = [
            p for p in matching_products
            if str(p.get("size", "")).upper() == cleaned_size
        ]
        
        # Find all other sizes available in stock for the same product name(s)
        available_other_sizes = [
            {"size": p["size"], "stock_count": p["stock_count"], "price": p["price"]}
            for p in matching_products
            if str(p.get("size", "")).upper() != cleaned_size and p["stock_count"] > 0
        ]

        if exact_size_matches:
            for item in exact_size_matches:
                is_in_stock = item["stock_count"] > 0
                results.append({
                    "product_id": item["id"],
                    "product_name": item["name"],
                    "category": item["category"],
                    "requested_size": item["size"],
                    "in_stock": is_in_stock,
                    "stock_count": item["stock_count"],
                    "price": item["price"],
                    "description": item["description"],
                    "alternative_available_sizes": available_other_sizes if not is_in_stock else [],
                    "note": "Item in requested size is currently OUT OF STOCK." if not is_in_stock else "Item is available."
                })
        else:
            # Size not found for this product
            all_sizes_for_prod = [
                {"size": p["size"], "stock_count": p["stock_count"], "in_stock": p["stock_count"] > 0}
                for p in matching_products
            ]
            results.append({
                "product_name": matching_products[0]["name"],
                "requested_size": size,
                "in_stock": False,
                "message": f"Size '{size}' is not offered or not found for {matching_products[0]['name']}.",
                "available_variants": all_sizes_for_prod,
            })
    else:
        # Return all variants matching the product name
        for item in matching_products:
            results.append({
                "product_id": item["id"],
                "product_name": item["name"],
                "category": item["category"],
                "size": item.get("size"),
                "in_stock": item["stock_count"] > 0,
                "stock_count": item["stock_count"],
                "price": item["price"],
                "description": item["description"],
            })

    return results


def apply_cart_recovery_discount(customer_email: str) -> Dict[str, Any]:
    """
    Check for an abandoned shopping cart session by customer email and generate/apply a discount code.

    Args:
        customer_email: Customer's email address (e.g., 'sarah.smith@example.com').

    Returns:
        A dictionary containing cart session status, abandoned items, discount code,
        percentage off, and validity expiration.
    """
    cleaned_email = customer_email.strip().lower()

    for session in CART_SESSIONS:
        if session["customer_email"].lower() == cleaned_email:
            if session.get("discount_eligible", False):
                return {
                    "success": True,
                    "customer_email": session["customer_email"],
                    "session_id": session["session_id"],
                    "abandoned_items": session.get("abandoned_items", []),
                    "discount_code": session.get("discount_code", "SAVE10"),
                    "discount_percentage": session.get("discount_percentage", 10),
                    "expires_in_hours": session.get("expires_in_hours", 24),
                    "message": f"Cart recovery discount of {session.get('discount_percentage', 10)}% successfully applied! Use code '{session.get('discount_code', 'SAVE10')}'."
                }
            else:
                return {
                    "success": False,
                    "customer_email": session["customer_email"],
                    "session_id": session["session_id"],
                    "reason": session.get("reason", "Customer is not currently eligible for an additional cart recovery discount.")
                }

    return {
        "success": False,
        "customer_email": customer_email,
        "error": f"No active or abandoned cart session found for '{customer_email}'.",
        "suggested_action": "Invite customer to add items to cart and check out on the store website."
    }


# =====================================================================
# OpenAI Tool Schemas (Latest tools / tool_calls JSON Schema Format)
# =====================================================================

OPENAI_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_order_status",
            "description": "Look up real-time status, tracking info, carrier, and estimated delivery for a customer order by its Order ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The unique order ID number provided by the customer (e.g., '1042', '#1043')."
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_product_inventory",
            "description": "Search product inventory, live stock counts, pricing, and size availability. Use this tool whenever a customer asks about product availability or stock.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "The name or descriptive keyword of the product (e.g., 'Classic White T-Shirt', 'Headphones', 'Denim Jeans')."
                    },
                    "size": {
                        "type": "string",
                        "description": "Optional size or variant code (e.g., 'S', 'M', 'L', 'XL', '32', '10')."
                    }
                },
                "required": ["product_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "apply_cart_recovery_discount",
            "description": "Check for abandoned cart sessions by customer email and retrieve or apply an exclusive recovery discount code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_email": {
                        "type": "string",
                        "description": "The customer's email address associated with the cart session (e.g., 'sarah.smith@example.com')."
                    }
                },
                "required": ["customer_email"]
            }
        }
    }
]


# Tool dispatcher map
TOOL_MAP = {
    "get_order_status": get_order_status,
    "check_product_inventory": check_product_inventory,
    "apply_cart_recovery_discount": apply_cart_recovery_discount,
}


def execute_tool(tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    Safely execute a tool function by name with parsed keyword arguments.
    """
    if tool_name not in TOOL_MAP:
        return {"error": f"Tool '{tool_name}' is not registered."}
    
    try:
        func = TOOL_MAP[tool_name]
        return func(**arguments)
    except Exception as e:
        return {"error": f"Error executing tool '{tool_name}': {str(e)}"}
