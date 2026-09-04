"""
Mock Data Layer for Autonomous E-Commerce AI Agent PoC.
Provides realistic datasets for Products, Orders, and Cart Sessions.
"""

from typing import List, Dict, Any, Optional

PRODUCTS: List[Dict[str, Any]] = [
    {
        "id": "PROD-001",
        "name": "Classic White T-Shirt",
        "category": "Apparel",
        "size": "S",
        "stock_count": 12,
        "price": 24.99,
        "description": "100% premium combed cotton crewneck t-shirt in crisp white.",
    },
    {
        "id": "PROD-002",
        "name": "Classic White T-Shirt",
        "category": "Apparel",
        "size": "M",
        "stock_count": 8,
        "price": 24.99,
        "description": "100% premium combed cotton crewneck t-shirt in crisp white.",
    },
    {
        "id": "PROD-003",
        "name": "Classic White T-Shirt",
        "category": "Apparel",
        "size": "L",
        "stock_count": 0,  # Explicitly out of stock for testing
        "price": 24.99,
        "description": "100% premium combed cotton crewneck t-shirt in crisp white.",
    },
    {
        "id": "PROD-004",
        "name": "Classic White T-Shirt",
        "category": "Apparel",
        "size": "XL",
        "stock_count": 4,
        "price": 24.99,
        "description": "100% premium combed cotton crewneck t-shirt in crisp white.",
    },
    {
        "id": "PROD-005",
        "name": "Slim Fit Denim Jeans",
        "category": "Apparel",
        "size": "30",
        "stock_count": 5,
        "price": 59.99,
        "description": "Modern slim-fit stretch denim with dark indigo wash.",
    },
    {
        "id": "PROD-006",
        "name": "Slim Fit Denim Jeans",
        "category": "Apparel",
        "size": "32",
        "stock_count": 10,
        "price": 59.99,
        "description": "Modern slim-fit stretch denim with dark indigo wash.",
    },
    {
        "id": "PROD-007",
        "name": "Slim Fit Denim Jeans",
        "category": "Apparel",
        "size": "34",
        "stock_count": 0,
        "price": 59.99,
        "description": "Modern slim-fit stretch denim with dark indigo wash.",
    },
    {
        "id": "PROD-008",
        "name": "Wireless Noise-Canceling Headphones",
        "category": "Electronics",
        "size": "Standard",
        "stock_count": 15,
        "price": 149.99,
        "description": "Over-ear active noise cancelling headphones with 30-hour battery life.",
    },
    {
        "id": "PROD-009",
        "name": "Ultra-Light Running Shoes",
        "category": "Footwear",
        "size": "9",
        "stock_count": 6,
        "price": 89.99,
        "description": "Breathable mesh running sneakers with responsive foam cushioning.",
    },
    {
        "id": "PROD-010",
        "name": "Ultra-Light Running Shoes",
        "category": "Footwear",
        "size": "10",
        "stock_count": 0,
        "price": 89.99,
        "description": "Breathable mesh running sneakers with responsive foam cushioning.",
    },
    {
        "id": "PROD-011",
        "name": "Ultra-Light Running Shoes",
        "category": "Footwear",
        "size": "11",
        "stock_count": 3,
        "price": 89.99,
        "description": "Breathable mesh running sneakers with responsive foam cushioning.",
    },
    {
        "id": "PROD-012",
        "name": "Organic Cotton Hoodie",
        "category": "Apparel",
        "size": "M",
        "stock_count": 14,
        "price": 49.99,
        "description": "Heavyweight French terry hoodie made from 100% certified organic cotton.",
    },
    {
        "id": "PROD-013",
        "name": "Organic Cotton Hoodie",
        "category": "Apparel",
        "size": "L",
        "stock_count": 9,
        "price": 49.99,
        "description": "Heavyweight French terry hoodie made from 100% certified organic cotton.",
    },
]

ORDERS: List[Dict[str, Any]] = [
    {
        "order_id": "1042",
        "customer_name": "Hamza Tariq",
        "customer_phone": "+923187806306",
        "status": "Shipped",
        "tracking_number": "TRK-FEDEX-984210",
        "tracking_url": "https://tracking.carrier.com/track/TRK-FEDEX-984210",
        "carrier": "FedEx Express",
        "items": [
            {"product_id": "PROD-002", "name": "Classic White T-Shirt", "size": "M", "quantity": 1, "price": 24.99},
            {"product_id": "PROD-006", "name": "Slim Fit Denim Jeans", "size": "32", "quantity": 1, "price": 59.99}
        ],
        "total_amount": 84.98,
        "order_date": "2026-08-28",
        "estimated_delivery": "September 2, 2026",
        "shipping_address": "452 Elm Street, Suite 3B, New York, NY 10001",
    },
    {
        "order_id": "1043",
        "customer_name": "Ali Khan",
        "customer_phone": "+923001234567",
        "status": "Processing",
        "tracking_number": "PENDING-LABEL-GEN",
        "tracking_url": None,
        "carrier": "DHL Express",
        "items": [
            {"product_id": "PROD-008", "name": "Wireless Noise-Canceling Headphones", "size": "Standard", "quantity": 1, "price": 149.99}
        ],
        "total_amount": 149.99,
        "order_date": "2026-08-30",
        "estimated_delivery": "September 1, 2026 (Tomorrow)",
        "shipping_address": "House 42-B, Block 6, PECHS, Karachi, Pakistan",
    },
    {
        "order_id": "1044",
        "customer_name": "Sarah Miller",
        "customer_phone": "+14155552671",
        "status": "Delivered",
        "tracking_number": "TRK-UPS-772911",
        "tracking_url": "https://tracking.carrier.com/track/TRK-UPS-772911",
        "carrier": "UPS Ground",
        "items": [
            {"product_id": "PROD-009", "name": "Ultra-Light Running Shoes", "size": "9", "quantity": 1, "price": 89.99}
        ],
        "total_amount": 89.99,
        "order_date": "2026-08-24",
        "estimated_delivery": "August 27, 2026 (Delivered)",
        "shipping_address": "784 Sunset Blvd, Los Angeles, CA 90028",
    },
    {
        "order_id": "1045",
        "customer_name": "Zubair Ahmed",
        "customer_phone": "+923219876543",
        "status": "Cancelled",
        "tracking_number": None,
        "tracking_url": None,
        "carrier": None,
        "items": [
            {"product_id": "PROD-012", "name": "Organic Cotton Hoodie", "size": "M", "quantity": 1, "price": 49.99}
        ],
        "total_amount": 49.99,
        "order_date": "2026-08-29",
        "estimated_delivery": None,
        "cancellation_reason": "Customer requested cancellation before fulfillment",
        "shipping_address": "Gulberg III, Lahore, Pakistan",
    }
]

CART_SESSIONS: List[Dict[str, Any]] = [
    {
        "session_id": "sess_abc123",
        "customer_email": "sarah.smith@example.com",
        "abandoned_items": [
            {"product_id": "PROD-012", "name": "Organic Cotton Hoodie", "size": "M", "price": 49.99, "quantity": 1}
        ],
        "discount_eligible": True,
        "discount_code": "SAVE15",
        "discount_percentage": 15,
        "expires_in_hours": 24,
    },
    {
        "session_id": "sess_xyz789",
        "customer_email": "ali.khan@example.com",
        "abandoned_items": [
            {"product_id": "PROD-008", "name": "Wireless Noise-Canceling Headphones", "size": "Standard", "price": 149.99, "quantity": 1}
        ],
        "discount_eligible": True,
        "discount_code": "RECOVER10",
        "discount_percentage": 10,
        "expires_in_hours": 48,
    },
    {
        "session_id": "sess_def456",
        "customer_email": "john.doe@example.com",
        "abandoned_items": [
            {"product_id": "PROD-005", "name": "Slim Fit Denim Jeans", "size": "30", "price": 59.99, "quantity": 1}
        ],
        "discount_eligible": False,
        "reason": "Customer has already redeemed a cart recovery promotion within the last 30 days.",
    },
]
