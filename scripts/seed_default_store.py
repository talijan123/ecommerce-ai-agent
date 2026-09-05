"""
Seed Default Store Tenant Script.

Creates or updates the primary default Store record using environment variables
(WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN / WHATSAPP_TOKEN), and associates
all unassigned existing Products, Orders, and ChatHistories (where store_id is NULL)
with this default store ID so that all existing data remains accessible in multi-tenant queries.
"""

import sys
import os

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.core.config import settings
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.product import Product
from app.models.order import Order
from app.models.chat import ChatHistory


def seed_default_store():
    """Seed the default tenant store and link existing unassigned records."""
    print("=" * 70)
    print(" 🏪 SEEDING DEFAULT STORE TENANT & LINKING UNASSIGNED DATA")
    print("=" * 70)

    # 1. Ensure DB schemas and columns exist
    ensure_db_initialized()

    # 2. Extract configuration
    phone_number_id = (
        os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
        or getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
        or "1330161100179237"
    )
    access_token = (
        os.environ.get("WHATSAPP_ACCESS_TOKEN")
        or os.environ.get("WHATSAPP_TOKEN")
        or getattr(settings, "WHATSAPP_TOKEN", "")
        or ""
    )

    default_name = "Primary Demo Store"
    default_email = "admin@example.com"
    default_prompt = (
        "You are a helpful, professional e-commerce AI assistant. "
        "Help customers track orders and check product inventory accurately."
    )

    print(f"🔹 Phone Number ID: {phone_number_id}")
    print(f"🔹 Store Name:      {default_name}")
    print(f"🔹 Owner Email:     {default_email}")
    print(f"🔹 Has Token:       {bool(access_token and len(access_token) > 20)}")

    db = SessionLocal()
    try:
        # 3. Check if store already exists by phone_number_id
        store = db.query(Store).filter(Store.whatsapp_phone_number_id == phone_number_id).first()

        if not store:
            print("\n➕ Creating new default Store record...")
            store = Store(
                name=default_name,
                owner_email=default_email,
                whatsapp_phone_number_id=phone_number_id,
                whatsapp_access_token=access_token,
                system_prompt=default_prompt,
                is_active=True,
            )
            db.add(store)
            db.commit()
            db.refresh(store)
            print(f"  ✓ Store created successfully! ID: {store.id}")
        else:
            print(f"\nℹ️ Store with WhatsApp Phone Number ID '{phone_number_id}' already exists (ID: {store.id}).")
            # Update token or prompt if missing
            updated = False
            if not store.whatsapp_access_token and access_token:
                store.whatsapp_access_token = access_token
                updated = True
            if not store.system_prompt:
                store.system_prompt = default_prompt
                updated = True
            if not store.name:
                store.name = default_name
                updated = True
            if not store.owner_email:
                store.owner_email = default_email
                updated = True
            if updated:
                db.commit()
                db.refresh(store)
                print("  ✓ Updated missing store configuration fields.")

        # 4. Associate unassigned products, orders, and chat histories
        print("\n🔗 Linking unassigned database records to default Store...")
        
        products_linked = (
            db.query(Product)
            .filter(Product.store_id.is_(None))
            .update({"store_id": store.id}, synchronize_session=False)
        )
        orders_linked = (
            db.query(Order)
            .filter(Order.store_id.is_(None))
            .update({"store_id": store.id}, synchronize_session=False)
        )
        chats_linked = (
            db.query(ChatHistory)
            .filter(ChatHistory.store_id.is_(None))
            .update({"store_id": store.id}, synchronize_session=False)
        )
        db.commit()

        print(f"  ✓ Products linked to store:      {products_linked}")
        print(f"  ✓ Orders linked to store:        {orders_linked}")
        print(f"  ✓ Chat sessions linked to store: {chats_linked}")

        # 5. Fetch total counts under this store
        total_products = db.query(Product).filter(Product.store_id == store.id).count()
        total_orders = db.query(Order).filter(Order.store_id == store.id).count()
        total_chats = db.query(ChatHistory).filter(ChatHistory.store_id == store.id).count()

        print("\n📊 Current Tenant Store Summary:")
        print(f"  • Store ID:        {store.id}")
        print(f"  • Store Name:      {store.name}")
        print(f"  • Status:          {'Active (True)' if store.is_active else 'Inactive (False)'}")
        print(f"  • Total Products:  {total_products}")
        print(f"  • Total Orders:    {total_orders}")
        print(f"  • Total Chats:     {total_chats}")

        print("\n" + "=" * 70)
        print(" 🎉 DEFAULT STORE SEEDING & LINKING COMPLETED SUCCESSFULLY!")
        print("=" * 70)

        return store

    finally:
        db.close()


if __name__ == "__main__":
    seed_default_store()
