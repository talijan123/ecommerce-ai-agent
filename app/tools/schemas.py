"""
OpenAI Tool Schemas and Database-Injected Execution Dispatcher.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.services.order_service import OrderService
from app.services.inventory_service import InventoryService
from app.services.cart_service import CartService


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


def execute_tool_with_db(db: Session, tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    Execute a tool against the database using the appropriate service instance.
    """
    order_service = OrderService(db)
    inventory_service = InventoryService(db)
    cart_service = CartService(db)

    if tool_name == "get_order_status":
        order_id = arguments.get("order_id", "")
        return order_service.get_order_by_id_or_number(order_id)

    elif tool_name == "check_product_inventory":
        product_name = arguments.get("product_name", "")
        size = arguments.get("size")
        return inventory_service.check_inventory(product_name, size)

    elif tool_name == "apply_cart_recovery_discount":
        customer_email = arguments.get("customer_email", "")
        return cart_service.apply_cart_recovery_discount(customer_email)

    else:
        return {"error": f"Tool '{tool_name}' is not recognized or supported."}
