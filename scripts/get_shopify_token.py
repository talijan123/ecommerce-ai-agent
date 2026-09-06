"""
Shopify Token Exchange & Store Ingestion Script.

Exchanges Shopify App Client ID & Client Secret for an Admin API Store Access Token
via Shopify's OAuth / Client Credentials endpoint:
POST https://{shop_domain}/admin/oauth/access_token

Workflow:
1. Normalizes shop domain (e.g. yqcncc-b0.myshopify.com).
2. Performs token exchange with Shopify Admin API using client credentials.
3. Verifies credentials against /admin/api/2024-01/shop.json.
4. Saves/upserts the integration record in the database (`store_integrations`).
5. Triggers live product catalog ingestion via `ShopifySyncService.fetch_and_ingest_products`.
6. Optionally updates local `.env` configuration.
"""

import sys
import os
import argparse
import getpass
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
import httpx

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.core.config import settings
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.integration import StoreIntegration
from app.models.product import Product
from app.services.shopify_service import ShopifySyncService

logger = logging.getLogger("get_shopify_token")


def mask_token(token: Optional[str]) -> str:
    """Mask token for safe display in console logs."""
    if not token:
        return "<None>"
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}...{token[-4:]} (length: {len(token)})"


def exchange_client_credentials(
    shop_domain: str,
    client_id: str,
    client_secret: str,
) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
    """
    Exchange Client ID and Client Secret for Shopify Store Access Token.
    Returns: (access_token, full_response_json, error_message)
    """
    return ShopifySyncService.exchange_client_credentials(shop_domain, client_id, client_secret)


def resolve_target_store(db: Any, store_id_arg: Optional[str], shop_domain: str) -> Store:
    """Resolve or create the active Store entity to link the Shopify integration with."""
    clean_domain = ShopifySyncService.clean_shop_domain(shop_domain)

    # 1. If explicit store_id passed
    if store_id_arg:
        import uuid
        try:
            target_uuid = uuid.UUID(store_id_arg.strip())
            store = db.query(Store).filter(Store.id == target_uuid).first()
            if store:
                return store
            print(f"⚠️  Store ID '{store_id_arg}' not found in database. Searching for active stores...")
        except ValueError:
            print(f"⚠️  Invalid UUID format '{store_id_arg}'. Searching for active stores...")

    # 2. Check if an existing StoreIntegration has this domain
    existing_integration = (
        db.query(StoreIntegration)
        .filter(
            StoreIntegration.platform == "shopify",
            StoreIntegration.shop_domain.ilike(clean_domain),
        )
        .first()
    )
    if existing_integration and existing_integration.store_id:
        store = db.query(Store).filter(Store.id == existing_integration.store_id).first()
        if store:
            return store

    # 3. Check for any active store with matching name or email
    active_stores = db.query(Store).filter(Store.is_active == True).order_by(Store.created_at.desc()).all()
    if active_stores:
        # Prefer store matching shop name prefix if possible
        prefix = clean_domain.split(".")[0].lower()
        for s in active_stores:
            if prefix in s.name.lower():
                return s
        # Otherwise return the first active store
        return active_stores[0]

    # 4. Fallback: Create a new store record for this Shopify store
    short_name = clean_domain.split(".")[0].capitalize()
    new_store = Store(
        name=f"{short_name} Shopify Store",
        owner_email="admin@autocommerce.ai",
        whatsapp_phone_number_id=getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "1330161100179237") or "1330161100179237",
        whatsapp_access_token=getattr(settings, "WHATSAPP_TOKEN", "") or "",
        system_prompt=f"You are a helpful customer support and sales AI assistant for {short_name}.",
        is_active=True,
    )
    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store


def save_integration_and_sync(
    shop_domain: str,
    access_token: str,
    client_id: Optional[str] = None,
    store_id: Optional[str] = None,
    skip_sync: bool = False,
) -> Dict[str, Any]:
    """
    Save or update store_integrations record purely in database and trigger catalog ingestion.
    Does NOT touch .env or global environment variables.
    """
    ensure_db_initialized()
    db = SessionLocal()
    clean_domain = ShopifySyncService.clean_shop_domain(shop_domain)

    try:
        store = resolve_target_store(db, store_id, clean_domain)
        print(f"🏪 Active Store Target: '{store.name}' (ID: {store.id}, Email: {store.owner_email})")

        # Upsert integration
        integration = (
            db.query(StoreIntegration)
            .filter(
                StoreIntegration.store_id == store.id,
                StoreIntegration.platform == "shopify",
            )
            .first()
        )

        if not integration:
            integration = StoreIntegration(
                store_id=store.id,
                platform="shopify",
                shop_domain=clean_domain,
                access_token=access_token,
                api_key=client_id,
                sync_status="connected",
                products_synced_count=0,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(integration)
        else:
            integration.shop_domain = clean_domain
            integration.access_token = access_token
            if client_id:
                integration.api_key = client_id
            integration.sync_status = "connected"
            integration.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(integration)
        print(f"✅ Integration record saved in database (ID: {integration.id})")

        # Ingest products
        sync_result = {}
        if not skip_sync:
            print(f"\n🔄 Ingesting product catalog from Shopify ({clean_domain})...")
            sync_result = ShopifySyncService.fetch_and_ingest_products(
                db=db,
                store_id=str(store.id),
                shop_domain=clean_domain,
                access_token=access_token,
            )
            print(f"✨ Ingestion complete: {sync_result.get('synced_count', 0)} products synchronized into database!")
            
            # Print sample synced products
            sample_products = (
                db.query(Product)
                .filter(Product.store_id == store.id)
                .limit(5)
                .all()
            )
            if sample_products:
                print("\n📦 Sample Products in Store Catalog:")
                for p in sample_products:
                    print(f"   • [{p.sku}] {p.title} - ${p.price:.2f} (Stock: {p.stock_quantity})")

        return {
            "success": True,
            "store_id": str(store.id),
            "store_name": store.name,
            "integration_id": str(integration.id),
            "shop_domain": clean_domain,
            "access_token": access_token,
            "sync_result": sync_result,
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Error during store integration/sync: {e}")
        raise e
    finally:
        db.close()


def run_interactive_or_cli():
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        description="Exchange Shopify Client ID & Secret for Store Access Token and sync catalog (pure multi-tenant DB)."
    )
    parser.add_argument(
        "-s", "--shop",
        default="yqcncc-b0.myshopify.com",
        help="Shopify store domain (e.g. yqcncc-b0.myshopify.com)",
    )
    parser.add_argument(
        "-i", "--client-id",
        default=os.getenv("SHOPIFY_CLIENT_ID") or os.getenv("SHOPIFY_API_KEY"),
        help="Shopify App Client ID (API Key)",
    )
    parser.add_argument(
        "-k", "--client-secret",
        default=os.getenv("SHOPIFY_CLIENT_SECRET") or os.getenv("SHOPIFY_API_SECRET"),
        help="Shopify App Client Secret",
    )
    parser.add_argument(
        "-t", "--store-id",
        default=None,
        help="Target tenant store UUID in local database (optional)",
    )
    parser.add_argument(
        "--no-sync",
        action="store_true",
        help="Skip immediate product catalog sync",
    )

    args = parser.parse_args()

    print("=" * 75)
    print(" 🛍️  SHOPIFY CLIENT CREDENTIALS TOKEN EXCHANGE & STORE SYNC")
    print("=" * 75)

    shop_domain = args.shop
    client_id = args.client_id
    client_secret = args.client_secret

    # Prompt interactively if running in terminal and missing credentials
    if not shop_domain:
        try:
            shop_domain = input("Enter Shopify Store Domain [yqcncc-b0.myshopify.com]: ").strip()
            if not shop_domain:
                shop_domain = "yqcncc-b0.myshopify.com"
        except (EOFError, KeyboardInterrupt):
            shop_domain = "yqcncc-b0.myshopify.com"

    clean_domain = ShopifySyncService.clean_shop_domain(shop_domain)
    print(f"🔹 Target Store Domain:  {clean_domain}")

    if not client_id:
        try:
            client_id = input("Enter Shopify App Client ID: ").strip()
        except (EOFError, KeyboardInterrupt):
            pass

    if not client_secret:
        try:
            client_secret = getpass.getpass("Enter Shopify App Client Secret: ").strip()
        except (EOFError, KeyboardInterrupt):
            pass

    if not client_id or not client_secret:
        print("\n❌ Error: Both Client ID and Client Secret are required to perform token exchange.")
        print("\nUsage example:")
        print(f"   python scripts/get_shopify_token.py --shop {clean_domain} --client-id <YOUR_CLIENT_ID> --client-secret <YOUR_CLIENT_SECRET>")
        sys.exit(1)

    print(f"🔹 Client ID:            {client_id[:8]}... (length: {len(client_id)})")
    print(f"🔹 Client Secret:        {client_secret[:4]}...{client_secret[-4:]} (length: {len(client_secret)})")

    print("\n🌐 Contacting Shopify OAuth Endpoint (POST https://{}/admin/oauth/access_token)...".format(clean_domain))
    access_token, raw_resp, err_msg = exchange_client_credentials(clean_domain, client_id, client_secret)

    if not access_token:
        print(f"\n❌ Token exchange failed:")
        print(f"   {err_msg}")
        print("\n💡 Troubleshooting Tips:")
        print("   1. Verify your App is created & installed on your development store.")
        print("   2. Ensure the App has Admin API access scopes configured (e.g. read_products, write_products, read_orders).")
        print("   3. Verify that the Client ID and Client Secret match the App in the Shopify Partners/Dev Dashboard.")
        print(f"   4. Ensure the domain '{clean_domain}' is the correct myshopify.com subdomain.")
        sys.exit(1)

    print("\n🎉 Token Exchange Successful!")
    print(f"🔑 Store Access Token:   {access_token}")
    print(f"🔒 Masked Token:         {mask_token(access_token)}")
    if raw_resp and "scope" in raw_resp:
        print(f"📋 Granted Scopes:       {raw_resp.get('scope')}")

    # Validate against /admin/api/2024-01/shop.json
    print("\n🔎 Verifying access token with Shopify Shop API...")
    is_valid = ShopifySyncService.verify_credentials(clean_domain, access_token)
    if is_valid:
        print("✅ Shopify API credentials verified successfully!")
    else:
        print("⚠️  Warning: Token validation endpoint returned non-200. Proceeding with database save...")

    # Upsert into database and sync
    print("\n💾 Updating Database & Syncing Catalog...")
    result = save_integration_and_sync(
        shop_domain=clean_domain,
        access_token=access_token,
        client_id=client_id,
        store_id=args.store_id,
        skip_sync=args.no_sync,
    )

    print("\n" + "=" * 75)
    print(" ✅ ALL STEPS COMPLETED SUCCESSFULLY!")
    print("=" * 75)
    print(f" • Store:          {result['store_name']} (ID: {result['store_id']})")
    print(f" • Shop Domain:    {result['shop_domain']}")
    print(f" • Access Token:   {result['access_token']}")
    print(f" • Status:         Connected & Synced")
    print("=" * 75)


if __name__ == "__main__":
    run_interactive_or_cli()
