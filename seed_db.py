"""
Database Seeding Script: Automatically initializes and populates the database
with realistic e-commerce products, orders, and abandoned cart sessions.
"""

import sys

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.core.database import Base, engine, SessionLocal
from app.models.product import Product
from app.models.order import Order
from app.models.cart import CartSession


def seed_database():
    print("=" * 60)
    print("[INFO] Initializing and Seeding Database...")
    print("=" * 60)

    # Create tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Clear existing data
        db.query(Product).delete()
        db.query(Order).delete()
        db.query(CartSession).delete()
        db.commit()

        # 2. Seed Products
        products_data = [
            {
                "sku": "TSHIRT-WHT-001",
                "title": "Classic White T-Shirt",
                "description": "100% premium combed cotton crewneck t-shirt in crisp white.",
                "category": "Apparel",
                "price": 24.99,
                "stock_quantity": 24,
                "size_variants": [
                    {"size": "S", "stock": 12},
                    {"size": "M", "stock": 8},
                    {"size": "L", "stock": 0},  # Explicitly out of stock for testing
                    {"size": "XL", "stock": 4},
                ],
            },
            {
                "sku": "JEANS-DNM-002",
                "title": "Slim Fit Denim Jeans",
                "description": "Modern slim-fit stretch denim with dark indigo wash.",
                "category": "Apparel",
                "price": 59.99,
                "stock_quantity": 15,
                "size_variants": [
                    {"size": "30", "stock": 5},
                    {"size": "32", "stock": 10},
                    {"size": "34", "stock": 0},
                ],
            },
            {
                "sku": "TECH-HDPH-003",
                "title": "Wireless Noise-Canceling Headphones",
                "description": "Over-ear active noise cancelling headphones with 30-hour battery life.",
                "category": "Electronics",
                "price": 149.99,
                "stock_quantity": 15,
                "size_variants": [
                    {"size": "Standard", "stock": 15}
                ],
            },
            {
                "sku": "SHOE-RUN-004",
                "title": "Ultra-Light Running Shoes",
                "description": "Breathable mesh running sneakers with responsive foam cushioning.",
                "category": "Footwear",
                "price": 89.99,
                "stock_quantity": 9,
                "size_variants": [
                    {"size": "9", "stock": 6},
                    {"size": "10", "stock": 0},
                    {"size": "11", "stock": 3},
                ],
            },
            {
                "sku": "HOODIE-ORG-005",
                "title": "Organic Cotton Hoodie",
                "description": "Heavyweight French terry hoodie made from 100% certified organic cotton.",
                "category": "Apparel",
                "price": 49.99,
                "stock_quantity": 23,
                "size_variants": [
                    {"size": "M", "stock": 14},
                    {"size": "L", "stock": 9},
                ],
            },
        ]

        for p_data in products_data:
            db.add(Product(**p_data))

        # 3. Seed Orders
        orders_data = [
            {
                "order_number": "1042",
                "customer_name": "Hamza Tariq",
                "customer_email": "hamza.tariq@example.com",
                "status": "Shipped",
                "carrier": "FedEx Express",
                "tracking_number": "TRK-FEDEX-984210",
                "tracking_url": "https://tracking.carrier.com/track/TRK-FEDEX-984210",
                "estimated_delivery": "September 2, 2026",
                "items": [
                    {"name": "Classic White T-Shirt", "size": "M", "quantity": 1, "price": 24.99},
                    {"name": "Slim Fit Denim Jeans", "size": "32", "quantity": 1, "price": 59.99}
                ],
                "total_amount": 84.98,
                "shipping_address": "452 Elm Street, Suite 3B, New York, NY 10001",
            },
            {
                "order_number": "1043",
                "customer_name": "Ali Khan",
                "customer_email": "ali.khan@example.com",
                "status": "Processing",
                "carrier": "DHL Express",
                "tracking_number": "PENDING-LABEL-GEN",
                "tracking_url": None,
                "estimated_delivery": "September 1, 2026 (Tomorrow)",
                "items": [
                    {"name": "Wireless Noise-Canceling Headphones", "size": "Standard", "quantity": 1, "price": 149.99}
                ],
                "total_amount": 149.99,
                "shipping_address": "House 42-B, Block 6, PECHS, Karachi, Pakistan",
            },
            {
                "order_number": "1044",
                "customer_name": "Sarah Miller",
                "customer_email": "sarah.miller@example.com",
                "status": "Delivered",
                "carrier": "UPS Ground",
                "tracking_number": "TRK-UPS-772911",
                "tracking_url": "https://tracking.carrier.com/track/TRK-UPS-772911",
                "estimated_delivery": "August 27, 2026 (Delivered)",
                "items": [
                    {"name": "Ultra-Light Running Shoes", "size": "9", "quantity": 1, "price": 89.99}
                ],
                "total_amount": 89.99,
                "shipping_address": "784 Sunset Blvd, Los Angeles, CA 90028",
            },
            {
                "order_number": "1045",
                "customer_name": "Zubair Ahmed",
                "customer_email": "zubair.ahmed@example.com",
                "status": "Cancelled",
                "carrier": None,
                "tracking_number": None,
                "tracking_url": None,
                "estimated_delivery": None,
                "items": [
                    {"name": "Organic Cotton Hoodie", "size": "M", "quantity": 1, "price": 49.99}
                ],
                "total_amount": 49.99,
                "shipping_address": "Gulberg III, Lahore, Pakistan",
                "cancellation_reason": "Customer requested cancellation before fulfillment",
            },
        ]

        for o_data in orders_data:
            db.add(Order(**o_data))

        # 4. Seed Cart Sessions
        carts_data = [
            {
                "session_id": "sess_abc123",
                "customer_email": "sarah.smith@example.com",
                "abandoned_items": [
                    {"name": "Organic Cotton Hoodie", "size": "M", "price": 49.99, "quantity": 1}
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
                    {"name": "Wireless Noise-Canceling Headphones", "size": "Standard", "price": 149.99, "quantity": 1}
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
                    {"name": "Slim Fit Denim Jeans", "size": "30", "price": 59.99, "quantity": 1}
                ],
                "discount_eligible": False,
                "ineligibility_reason": "Customer has already redeemed a cart recovery promotion within the last 30 days.",
            },
        ]

        for c_data in carts_data:
            db.add(CartSession(**c_data))

        db.commit()
        print("[SUCCESS] Database successfully seeded:")
        print(f"   - {len(products_data)} Products")
        print(f"   - {len(orders_data)} Orders")
        print(f"   - {len(carts_data)} Cart Sessions")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
