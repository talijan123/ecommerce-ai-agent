"""
Tool and Function Calling Layer for Autonomous E-Commerce AI Agent.
Defines Python tool functions with strict typing and docstrings, along with
their corresponding OpenAI Tool Schemas (tools / tool_calls format).
"""

import re
from typing import List, Dict, Any, Optional
from mock_data import PRODUCTS, ORDERS, CART_SESSIONS
from app.services.ecommerce_service import ecommerce_service


def get_order_status(order_id: str, phone: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieve real-time status and shipping details for a customer order by its Order ID.
    Enforces phone verification check when customer phone is provided.

    Args:
        order_id: The unique identifier of the order (e.g., '1042', '#1043').
        phone: Optional customer phone number for security authorization.

    Returns:
        A dictionary containing order status, items, carrier, tracking information,
        and estimated delivery date, or an error/security message.
    """
    return ecommerce_service.get_order_by_number(order_id=order_id, phone=phone)


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
    return ecommerce_service.get_product_stock(query=product_name, size=size)


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
                    },
                    "phone": {
                        "type": "string",
                        "description": "Optional customer phone number to verify authorization before returning order details."
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

# Supabase Tool Schemas
SUPABASE_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "track_order",
            "description": "Look up real-time status and shipping details for a customer order by Order ID in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {
                        "type": "string",
                        "description": "The unique order number provided by the customer (e.g., '1042', '#1043')."
                    }
                },
                "required": ["order_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_product_stock",
            "description": "Check product stock, price, and availability in the catalog by product name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "The name or keyword of the product."
                    }
                },
                "required": ["product_name"]
            }
        }
    }
]

from app.services.supabase_service import track_order, check_product_stock

# Tool dispatcher map
TOOL_MAP = {
    "get_order_status": get_order_status,
    "check_product_inventory": check_product_inventory,
    "apply_cart_recovery_discount": apply_cart_recovery_discount,
    "track_order": track_order,
    "check_product_stock": check_product_stock,
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
