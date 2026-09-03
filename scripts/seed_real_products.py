"""
Real Product Data Ingestion Script.
Fetches 100 real products from DummyJSON, transforms and maps attributes,
creates PostgreSQL tables on Supabase if needed, clears stale mock data,
and bulk inserts the products with variant structures.
"""

import sys
import os
import requests

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

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
from app.models.chat import ChatHistory

DUMMYJSON_URL = "https://dummyjson.com/products?limit=100"


def generate_size_variants(category: str, total_stock: int):
    """Generate realistic size/option variants based on product category and total stock."""
    cat_lower = category.lower()

    if any(c in cat_lower for c in ["shirt", "top", "dress", "hoodie", "apparel", "clothing", "womens", "mens"]):
        sizes = ["XS", "S", "M", "L", "XL"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        variants = []
        for i, size in enumerate(sizes):
            stock_val = base_stock + (remainder if i == 0 else 0)
            variants.append({"size": size, "stock": max(stock_val, 0)})
        return variants

    if any(c in cat_lower for c in ["shoe", "sneaker", "footwear", "boots"]):
        sizes = ["8", "9", "10", "11", "12"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        variants = []
        for i, size in enumerate(sizes):
            stock_val = base_stock + (remainder if i == 0 else 0)
            variants.append({"size": size, "stock": max(stock_val, 0)})
        return variants

    if any(c in cat_lower for c in ["fragrance", "beauty", "skin-care", "perfume"]):
        sizes = ["30ml", "50ml", "100ml"]
        base_stock = total_stock // len(sizes)
        remainder = total_stock % len(sizes)
        variants = []
        for i, size in enumerate(sizes):
            stock_val = base_stock + (remainder if i == 0 else 0)
            variants.append({"size": size, "stock": max(stock_val, 0)})
        return variants

    # Standard default variant
    return [{"size": "Standard", "stock": total_stock}]


def seed_real_products():
    print("=" * 65)
    print(" [INFO] Ingesting 100 Real Products from DummyJSON into Supabase...")
    print("=" * 65)

    # 1. Fetch 100 real products from DummyJSON
    print(f"-> Fetching catalog from {DUMMYJSON_URL} ...")
    resp = requests.get(DUMMYJSON_URL, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to fetch from DummyJSON: HTTP {resp.status_code} - {resp.text}")

    data = resp.json()
    raw_products = data.get("products", [])
    print(f"-> Successfully retrieved {len(raw_products)} products from DummyJSON.")

    # 2. Ensure database schema / tables are created in Supabase PostgreSQL
    print("-> Synchronizing PostgreSQL database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 3. Clear stale mock data
        print("-> Clearing stale data...")
        db.query(CartSession).delete()
        db.query(Order).delete()
        db.query(ChatHistory).delete()
        db.query(Product).delete()
        db.commit()

        # 4. Map and insert products
        print("-> Transforming and inserting 100 real products...")
        inserted_products = []
        for idx, item in enumerate(raw_products, start=1):
            title = item.get("title", "").strip()
            description = item.get("description", "").strip()
            category = item.get("category", "General").replace("-", " ").title()
            price = float(item.get("price", 0.0))
            stock = int(item.get("stock", 0))
            rating = float(item.get("rating", 0.0))

            # Prefer thumbnail, fallback to first image in images array
            image_url = item.get("thumbnail") or (item.get("images")[0] if item.get("images") else None)

            # Generate unique SKU if missing
            raw_sku = item.get("sku")
            clean_category_code = "".join([c for c in category if c.isalnum()])[:3].upper() or "GEN"
            sku = raw_sku if raw_sku else f"DJ-{clean_category_code}-{item.get('id', idx):03d}"

            variants = generate_size_variants(category, stock)

            product = Product(
                sku=sku,
                title=title,
                name=title,
                description=description,
                category=category,
                price=price,
                stock_quantity=stock,
                stock=stock,
                rating=rating,
                image_url=image_url,
                size_variants=variants,
            )
            db.add(product)
            inserted_products.append(product)

        db.commit()
        print(f"-> Successfully inserted {len(inserted_products)} real products into PostgreSQL.")

        # 5. Seed realistic demo orders and cart recovery sessions matching real products
        print("-> Seeding companion orders and cart sessions...")
        first_product = inserted_products[0]
        second_product = inserted_products[1] if len(inserted_products) > 1 else first_product
        third_product = inserted_products[2] if len(inserted_products) > 2 else first_product

        demo_orders = [
            Order(
                order_number="1042",
                customer_name="Hamza Tariq",
                customer_email="hamza.tariq@example.com",
                status="Shipped",
                carrier="FedEx Express",
                tracking_number="TRK-FEDEX-984210",
                tracking_url="https://tracking.carrier.com/track/TRK-FEDEX-984210",
                estimated_delivery="September 5, 2026",
                items=[
                    {"name": first_product.title, "size": first_product.size_variants[0]["size"], "quantity": 1, "price": first_product.price},
                    {"name": second_product.title, "size": second_product.size_variants[0]["size"], "quantity": 1, "price": second_product.price},
                ],
                total_amount=round(first_product.price + second_product.price, 2),
                shipping_address="452 Elm Street, Suite 3B, New York, NY 10001",
            ),
            Order(
                order_number="1043",
                customer_name="Ali Khan",
                customer_email="ali.khan@example.com",
                status="Processing",
                carrier="DHL Express",
                tracking_number="PENDING-LABEL-GEN",
                tracking_url=None,
                estimated_delivery="September 4, 2026 (Tomorrow)",
                items=[
                    {"name": third_product.title, "size": third_product.size_variants[0]["size"], "quantity": 1, "price": third_product.price}
                ],
                total_amount=round(third_product.price, 2),
                shipping_address="House 42-B, Block 6, PECHS, Karachi, Pakistan",
            ),
            Order(
                order_number="1044",
                customer_name="Sarah Miller",
                customer_email="sarah.miller@example.com",
                status="Delivered",
                carrier="UPS Ground",
                tracking_number="TRK-UPS-772911",
                tracking_url="https://tracking.carrier.com/track/TRK-UPS-772911",
                estimated_delivery="August 30, 2026 (Delivered)",
                items=[
                    {"name": first_product.title, "size": first_product.size_variants[0]["size"], "quantity": 2, "price": first_product.price}
                ],
                total_amount=round(first_product.price * 2, 2),
                shipping_address="784 Sunset Blvd, Los Angeles, CA 90028",
            ),
        ]
        for order in demo_orders:
            db.add(order)

        demo_carts = [
            CartSession(
                session_id="sess_abc123",
                customer_name="Sarah Smith",
                customer_email="sarah.smith@example.com",
                customer_phone="+14155552671",
                abandoned_items=[
                    {"name": first_product.title, "size": first_product.size_variants[0]["size"], "price": first_product.price, "quantity": 1}
                ],
                discount_eligible=True,
                discount_code="SAVE15",
                discount_percentage=15,
                expires_in_hours=24,
                recovery_sent=False,
            ),
            CartSession(
                session_id="sess_xyz789",
                customer_name="Ali Khan",
                customer_email="ali.khan@example.com",
                customer_phone="+923001234567",
                abandoned_items=[
                    {"name": third_product.title, "size": third_product.size_variants[0]["size"], "price": third_product.price, "quantity": 1}
                ],
                discount_eligible=True,
                discount_code="RECOVER10",
                discount_percentage=10,
                expires_in_hours=48,
                recovery_sent=False,
            ),
        ]
        for cart in demo_carts:
            db.add(cart)

        db.commit()

        # 6. Verification query
        product_count = db.query(Product).count()
        order_count = db.query(Order).count()
        cart_count = db.query(CartSession).count()

        print("=" * 65)
        print(" [SUCCESS] Supabase PostgreSQL Successfully Seeded:")
        print(f"    - {product_count} Real Products (with ratings & image URLs)")
        print(f"    - {order_count} Demo Orders")
        print(f"    - {cart_count} Abandoned Cart Recovery Sessions")
        print("=" * 65)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_real_products()
