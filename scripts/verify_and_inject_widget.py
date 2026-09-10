"""
Script: verify_and_inject_widget.py
Fetch active store's access token from the database, inspect existing Shopify ScriptTags via Admin REST API,
and inject the AutoCommerce storefront chat widget ScriptTag.
"""

import sys
import os
import httpx
import json

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.core.config import settings
from app.models.store import Store
from app.models.integration import StoreIntegration
from app.services.shopify_service import ShopifySyncService


def main():
    print("=" * 70)
    print("AutoCommerce Shopify Storefront Widget.js ScriptTag Verification & Injector")
    print("=" * 70)

    db = SessionLocal()
    try:
        target_domain = sys.argv[1].strip() if len(sys.argv) > 1 else None

        # 1. Fetch active Shopify store integration from database
        query = db.query(StoreIntegration).filter(
            StoreIntegration.platform == "shopify",
            StoreIntegration.shop_domain.isnot(None),
        )

        if target_domain:
            clean_target = ShopifySyncService.clean_shop_domain(target_domain)
            integration = query.filter(StoreIntegration.shop_domain.ilike(f"%{clean_target}%")).first()
        else:
            # Prioritize the active demo store with 17 synced products, or autocommerce-demo-store
            integration = (
                query.filter(StoreIntegration.shop_domain.ilike("%autocommerce-demo-store%"))
                .order_by(StoreIntegration.updated_at.desc().nullslast())
                .first()
            )
            if not integration:
                integration = query.order_by(StoreIntegration.updated_at.desc().nullslast()).first()

        if not integration:
            print("[ERROR] No Shopify store integration found in the database.")
            sys.exit(1)

        clean_domain = ShopifySyncService.clean_shop_domain(integration.shop_domain)
        access_token = (integration.access_token or "").strip()
        widget_url = getattr(settings, "WIDGET_JS_URL", None) or ShopifySyncService.get_widget_script_url()

        # Validate widget_url
        if not widget_url.startswith("https://") or "localhost" in widget_url:
            widget_url = "https://ecommerce-store-frontend-swart.vercel.app/widget.js"

        masked_token = f"{access_token[:6]}...{access_token[-4:]}" if len(access_token) > 10 else "***"
        print(f"Store ID       : {integration.store_id}")
        print(f"Shop Domain    : {clean_domain}")
        print(f"Access Token   : {masked_token}")
        print(f"Widget JS URL  : {widget_url}")
        print("-" * 70)

        if not access_token:
            print("[ERROR] Shopify access token is empty. Please authenticate via OAuth first.")
            sys.exit(1)

        api_version = ShopifySyncService.API_VERSION
        base_url = f"https://{clean_domain}/admin/api/{api_version}/script_tags.json"
        headers = {
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        # 2. GET existing script tags
        print(f"Querying GET {base_url} ...")
        with httpx.Client(timeout=15.0) as client:
            get_res = client.get(base_url, headers=headers)

        print(f"GET Status Code: {get_res.status_code}")
        existing_tags = []

        if get_res.status_code == 200:
            data = get_res.json()
            existing_tags = data.get("script_tags", [])
            print(f"Existing ScriptTags count: {len(existing_tags)}")
            for idx, tag in enumerate(existing_tags, 1):
                print(f"  [{idx}] ID: {tag.get('id')}, Event: {tag.get('event')}, Src: {tag.get('src')}")
        else:
            print(f"[WARN/ERROR] Shopify GET response (HTTP {get_res.status_code}):")
            print(get_res.text)
            if get_res.status_code == 403:
                auth_url = ShopifySyncService.build_authorization_url(clean_domain)
                print("\n[ATTENTION] Access token is missing 'read_script_tags' / 'write_script_tags' permissions.")
                print(f"Authorize the app with required scopes by visiting:\n{auth_url}\n")

        # 3. Check if widget script tag already exists
        matched_tag = None
        for tag in existing_tags:
            src = (tag.get("src") or "").strip()
            if src == widget_url or src.endswith("/widget.js"):
                matched_tag = tag
                break

        if matched_tag:
            print("-" * 70)
            print(f"[OK] Widget ScriptTag is already present on {clean_domain}!")
            print(f"ScriptTag ID : {matched_tag.get('id')}")
            print(f"Script URL   : {matched_tag.get('src')}")
            print("=" * 70)
            return

        # 4. If not present, POST the script tag
        print("-" * 70)
        print(f"Injecting ScriptTag via POST {base_url} ...")
        payload = {
            "script_tag": {
                "event": "onload",
                "src": widget_url,
                "display_scope": "all",
            }
        }
        print(f"Payload: {json.dumps(payload, indent=2)}")

        with httpx.Client(timeout=15.0) as client:
            post_res = client.post(base_url, json=payload, headers=headers)

        print(f"POST Status Code: {post_res.status_code}")
        if post_res.status_code == 201:
            res_data = post_res.json()
            created_tag = res_data.get("script_tag", {})
            tag_id = created_tag.get("id")
            print(f"ScriptTag created successfully with ID: {tag_id}")
            print(f"[SUCCESS] ScriptTag confirmed injected: {json.dumps(created_tag, indent=2)}")
        elif post_res.status_code == 422 and "already been taken" in post_res.text:
            print(f"[INFO] ScriptTag source '{widget_url}' was already registered.")
        else:
            print(f"[ERROR] Shopify error response payload (HTTP {post_res.status_code}):")
            print(post_res.text)
            if post_res.status_code == 403:
                auth_url = ShopifySyncService.build_authorization_url(clean_domain)
                print("\n[ACTION REQUIRED] Missing required scopes (write_script_tags).")
                print(f"Please re-authorize the app at:\n{auth_url}\n")

        print("=" * 70)

    finally:
        db.close()


if __name__ == "__main__":
    main()
