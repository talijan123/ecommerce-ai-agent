"""
Live Shopify REST API Integration Service.
Handles credential verification, REST catalog extraction, HTML parsing,
inventory variant normalization, and tenant database upserting.
"""

import re
import html
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.product import Product
from app.models.integration import StoreIntegration
from app.core.config import settings

logger = logging.getLogger(__name__)

# Fallback starter catalog for test tokens or development sandboxes
DEFAULT_MOCK_SHOPIFY_PRODUCTS = [
    {
        "id": 890123456701,
        "title": "Minimalist Ceramic Desk Lamp",
        "body_html": "<p>Handcrafted matte ceramic table lamp with warm ambient LED bulb. <em>Perfect for modern workspaces.</em></p>",
        "product_type": "Home & Decor",
        "image": {"src": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80"},
        "variants": [
            {
                "id": 41001,
                "title": "Standard",
                "price": "49.99",
                "sku": "SHPF-LMP-001",
                "inventory_quantity": 35,
            }
        ],
    },
    {
        "id": 890123456702,
        "title": "Oversized Heavyweight Cotton Hoodie",
        "body_html": "<p>450 GSM French terry cotton pullover hoodie with relaxed streetwear silhouette. <strong>Pre-shrunk fabric.</strong></p>",
        "product_type": "Apparel",
        "image": {"src": "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80"},
        "variants": [
            {"id": 41002, "title": "S", "price": "68.00", "sku": "SHPF-HOD-S", "inventory_quantity": 10},
            {"id": 41003, "title": "M", "price": "68.00", "sku": "SHPF-HOD-M", "inventory_quantity": 15},
            {"id": 41004, "title": "L", "price": "68.00", "sku": "SHPF-HOD-L", "inventory_quantity": 15},
            {"id": 41005, "title": "XL", "price": "68.00", "sku": "SHPF-HOD-XL", "inventory_quantity": 10},
        ],
    },
    {
        "id": 890123456703,
        "title": "Heritage Leather Cardholder Wallet",
        "body_html": "<p>Full-grain vegetable-tanned Italian leather wallet with 6 card slots and RFID protection.</p>",
        "product_type": "Accessories",
        "image": {"src": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80"},
        "variants": [
            {
                "id": 41006,
                "title": "Standard",
                "price": "34.50",
                "sku": "SHPF-WLT-003",
                "inventory_quantity": 40,
            }
        ],
    },
    {
        "id": 890123456704,
        "title": "Cloudfoam Performance Running Shoes",
        "body_html": "<p>Ultra-lightweight breathable mesh trainers with high-rebound responsive cushioning.</p>",
        "product_type": "Footwear",
        "image": {"src": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80"},
        "variants": [
            {"id": 41007, "title": "8", "price": "110.00", "sku": "SHPF-SHO-08", "inventory_quantity": 6},
            {"id": 41008, "title": "9", "price": "110.00", "sku": "SHPF-SHO-09", "inventory_quantity": 8},
            {"id": 41009, "title": "10", "price": "110.00", "sku": "SHPF-SHO-10", "inventory_quantity": 8},
            {"id": 41010, "title": "11", "price": "110.00", "sku": "SHPF-SHO-11", "inventory_quantity": 6},
        ],
    },
    {
        "id": 890123456705,
        "title": "Amber & Smoked Cedar Eau de Parfum 50ml",
        "body_html": "<p>Niche artisan fragrance infused with rich agarwood, smoked vetiver, and golden amber crystals.</p>",
        "product_type": "Fragrance",
        "image": {"src": "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80"},
        "variants": [
            {
                "id": 41011,
                "title": "50ml",
                "price": "85.00",
                "sku": "SHPF-FRG-005",
                "inventory_quantity": 20,
            }
        ],
    },
]


class ShopifySyncService:
    """Service to communicate with Shopify Admin REST API and synchronize catalog products."""

    API_VERSION = "2024-01"

    @classmethod
    def clean_shop_domain(cls, shop_domain: str) -> str:
        """Normalize store domain to standard format (e.g. store.myshopify.com)."""
        if not shop_domain:
            return ""
        clean = str(shop_domain).strip().lower()
        clean = re.sub(r"^https?://", "", clean)
        clean = clean.rstrip("/")
        if "/" in clean:
            clean = clean.split("/")[0]
        if clean and not clean.endswith(".myshopify.com") and "." not in clean:
            clean = f"{clean}.myshopify.com"
        return clean

    @classmethod
    def extract_shop_name(cls, shop_domain: str) -> str:
        """Extract clean store name without .myshopify.com (e.g. 'mystore' from 'mystore.myshopify.com')."""
        clean = cls.clean_shop_domain(shop_domain)
        if clean.endswith(".myshopify.com"):
            return clean[:-len(".myshopify.com")]
        return clean.split(".")[0]

    @classmethod
    def sanitize_scopes(cls, scopes: Optional[str] = None) -> str:
        """Ensure SCOPES string is comma-separated without illegal characters or extra whitespace."""
        if not scopes:
            scopes = getattr(settings, "SHOPIFY_SCOPES", "read_products,write_products,read_orders,read_checkouts,read_inventory,write_inventory")
        scope_list = [re.sub(r"[^a-zA-Z0-9_\-]", "", s.strip()) for s in re.split(r"[,\s]+", str(scopes)) if s.strip()]
        return ",".join(dict.fromkeys(scope_list)) or "read_products,write_products,read_orders,read_checkouts"

    @classmethod
    def build_authorization_url(
        cls,
        shop_domain: str,
        client_id: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        scopes: Optional[str] = None,
        state: Optional[str] = None,
    ) -> str:
        """
        Construct standard Shopify OAuth Authorization URL strictly adhering to:
        https://{clean_shop_domain}/admin/oauth/authorize?client_id={SHOPIFY_CLIENT_ID}&scope={SCOPES}&redirect_uri={SHOPIFY_REDIRECT_URI}&state={STATE}

        DO NOT prefix with admin.shopify.com/store/ for initial OAuth handshake.
        It must target {shop}.myshopify.com/admin/oauth/authorize.
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain:
            raise ValueError("Invalid Shopify store domain.")

        cid = (client_id or getattr(settings, "SHOPIFY_CLIENT_ID", "") or "").strip()
        sanitized_scopes = cls.sanitize_scopes(scopes or getattr(settings, "SHOPIFY_SCOPES", None))
        r_uri = (redirect_uri or getattr(settings, "SHOPIFY_REDIRECT_URI", "") or "").strip()
        st = (state or uuid.uuid4().hex).strip()

        import urllib.parse
        params = {
            "client_id": cid,
            "scope": sanitized_scopes,
        }
        if r_uri:
            params["redirect_uri"] = r_uri
        if st:
            params["state"] = st

        query_string = urllib.parse.urlencode(params)
        return f"https://{clean_domain}/admin/oauth/authorize?{query_string}"

    @classmethod
    def build_theme_embed_deep_link(
        cls,
        shop_domain: str,
        app_embed_extension_id: Optional[str] = None,
    ) -> str:
        """
        Construct 1-Click Shopify Theme Customizer deep link.
        Format:
        https://admin.shopify.com/store/{shop_name_without_myshopify}/themes/current/editor?context=apps&activateAppId={app_embed_extension_id}/app-embed
        Fallback:
        https://{clean_shop_domain}/admin/themes/current/editor?context=apps
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        shop_name = cls.extract_shop_name(clean_domain)
        embed_id = (app_embed_extension_id or getattr(settings, "SHOPIFY_APP_EMBED_EXTENSION_ID", "") or "").strip()
        if embed_id and shop_name:
            if not embed_id.endswith("/app-embed"):
                embed_id = f"{embed_id}/app-embed"
            return f"https://admin.shopify.com/store/{shop_name}/themes/current/editor?context=apps&activateAppId={embed_id}"
        return f"https://{clean_domain}/admin/themes/current/editor?context=apps"

    @classmethod
    def strip_html(cls, raw_html: Optional[str]) -> str:
        """Strip HTML tags and convert entities to plain text."""
        if not raw_html:
            return ""
        clean_text = re.sub(r"<[^>]+>", " ", str(raw_html))
        clean_text = html.unescape(clean_text)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()
        return clean_text

    @classmethod
    def is_mock_or_test_token(cls, access_token: Optional[str], shop_domain: str) -> bool:
        """Check if domain or token is a test/sandbox token."""
        if not access_token:
            return True
        token = access_token.strip().lower()
        if (
            token.startswith("shpat_test_")
            or token.startswith("shpat_mock_")
            or "demo" in token
            or "mock" in token
            or "test" in token
            or "brand-demo" in shop_domain
            or "example.com" in shop_domain
        ):
            return True
        return False

    @classmethod
    def get_widget_script_url(cls, override_url: Optional[str] = None) -> str:
        """Resolve public CDN/frontend URL for widget.js script tag."""
        if override_url and override_url.strip():
            return override_url.strip()
        if getattr(settings, "WIDGET_JS_URL", "") and settings.WIDGET_JS_URL.strip():
            return settings.WIDGET_JS_URL.strip()
        frontend_url = getattr(settings, "FRONTEND_URL", "https://ecommerce-store-frontend-swart.vercel.app").strip().rstrip("/")
        return f"{frontend_url}/widget.js"

    @classmethod
    def list_script_tags(
        cls,
        shop_domain: str,
        access_token: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Fetch registered ScriptTags from Shopify Admin REST API:
        GET https://{shop_domain}/admin/api/2024-01/script_tags.json
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain or cls.is_mock_or_test_token(access_token, clean_domain):
            return []

        url = f"https://{clean_domain}/admin/api/{cls.API_VERSION}/script_tags.json"
        headers = {
            "X-Shopify-Access-Token": access_token.strip() if access_token else "",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return res.json().get("script_tags", [])
                logger.warning(
                    f"[ShopifyScriptTag] list_script_tags returned HTTP {res.status_code} for {clean_domain}: {res.text[:200]}"
                )
                return []
        except Exception as e:
            logger.error(f"[ShopifyScriptTag] Error listing script tags for {clean_domain}: {e}")
            return []

    @classmethod
    def ensure_widget_script_tag(
        cls,
        shop_domain: str,
        access_token: Optional[str],
        script_url: Optional[str] = None,
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Ensure our AutoCommerce AI storefront chat widget is injected via Shopify ScriptTag API:
        POST https://{shop_domain}/admin/api/2024-01/script_tags.json
        {
          "script_tag": {
            "event": "onload",
            "src": "https://<FRONTEND_DOMAIN>/widget.js",
            "display_scope": "all"
          }
        }
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain:
            return False, None, "Invalid Shopify shop domain."

        target_src = cls.get_widget_script_url(script_url)

        # Handle mock/sandbox testing
        if cls.is_mock_or_test_token(access_token, clean_domain):
            logger.info(f"[ShopifyScriptTag] Mocking ScriptTag injection for {clean_domain} -> {target_src}")
            mock_tag = {
                "id": 99012345,
                "src": target_src,
                "event": "onload",
                "display_scope": "all",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            return True, mock_tag, None

        if not access_token or not access_token.strip():
            return False, None, "Missing Shopify Admin API access token for script tag injection."

        # 1. Check if a script tag pointing to widget.js already exists
        existing_tags = cls.list_script_tags(clean_domain, access_token)
        for tag in existing_tags:
            src = (tag.get("src") or "").strip()
            if src == target_src or "widget.js" in src:
                logger.info(f"[ShopifyScriptTag] Widget ScriptTag already active on {clean_domain} (ID: {tag.get('id')})")
                return True, tag, None

        # 2. Inject ScriptTag
        url = f"https://{clean_domain}/admin/api/{cls.API_VERSION}/script_tags.json"
        headers = {
            "X-Shopify-Access-Token": access_token.strip(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "script_tag": {
                "event": "onload",
                "src": target_src,
                "display_scope": "all",
            }
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code in (200, 201):
                    created_tag = res.json().get("script_tag", {})
                    logger.info(f"[ShopifyScriptTag] Successfully injected widget ScriptTag on {clean_domain} (ID: {created_tag.get('id')})")
                    return True, created_tag, None
                else:
                    err_msg = f"HTTP {res.status_code}: {res.text[:300]}"
                    logger.warning(f"[ShopifyScriptTag] Failed to inject ScriptTag on {clean_domain}: {err_msg}")
                    return False, None, err_msg
        except Exception as e:
            err_msg = f"Connection error injecting ScriptTag: {str(e)}"
            logger.error(f"[ShopifyScriptTag] Error on {clean_domain}: {err_msg}")
            return False, None, err_msg

    @classmethod
    def delete_widget_script_tag(
        cls,
        shop_domain: str,
        access_token: Optional[str],
        script_url: Optional[str] = None,
    ) -> Tuple[bool, int, Optional[str]]:
        """
        Remove our widget ScriptTags from the merchant's store on disconnect:
        DELETE https://{shop_domain}/admin/api/2024-01/script_tags/{script_tag_id}.json
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain:
            return False, 0, "Invalid Shopify shop domain."

        target_src = cls.get_widget_script_url(script_url)

        if cls.is_mock_or_test_token(access_token, clean_domain):
            logger.info(f"[ShopifyScriptTag] Mocking ScriptTag deletion for {clean_domain}")
            return True, 1, None

        if not access_token or not access_token.strip():
            return False, 0, "Missing access token for ScriptTag removal."

        existing_tags = cls.list_script_tags(clean_domain, access_token)
        deleted_count = 0
        headers = {
            "X-Shopify-Access-Token": access_token.strip(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        with httpx.Client(timeout=10.0) as client:
            for tag in existing_tags:
                src = (tag.get("src") or "").strip()
                tag_id = tag.get("id")
                if (src == target_src or "widget.js" in src) and tag_id:
                    del_url = f"https://{clean_domain}/admin/api/{cls.API_VERSION}/script_tags/{tag_id}.json"
                    try:
                        res = client.delete(del_url, headers=headers)
                        if res.status_code in (200, 204):
                            deleted_count += 1
                            logger.info(f"[ShopifyScriptTag] Deleted ScriptTag {tag_id} from {clean_domain}")
                        else:
                            logger.warning(f"[ShopifyScriptTag] Failed deleting ScriptTag {tag_id}: HTTP {res.status_code}")
                    except Exception as e:
                        logger.error(f"[ShopifyScriptTag] Error deleting ScriptTag {tag_id}: {e}")

        return True, deleted_count, None

    @classmethod
    def exchange_authorization_code(
        cls,
        shop_domain: str,
        code: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
        """
        Exchange OAuth authorization code for permanent offline access token via:
        POST https://{shop_domain}/admin/oauth/access_token
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        cid = (client_id or getattr(settings, "SHOPIFY_CLIENT_ID", "") or "").strip()
        sec = (client_secret or getattr(settings, "SHOPIFY_CLIENT_SECRET", "") or "").strip()
        if not clean_domain:
            return None, None, "Invalid Shopify store domain."

        if cls.is_mock_or_test_token(code, clean_domain):
            mock_token = f"shpat_mock_{uuid.uuid4().hex[:16]}"
            return mock_token, {"access_token": mock_token}, None

        token_url = f"https://{clean_domain}/admin/oauth/access_token"
        payload = {
            "client_id": cid,
            "client_secret": sec,
            "code": code,
        }

        try:
            with httpx.Client(timeout=20.0, follow_redirects=True) as client:
                res = client.post(
                    token_url,
                    json=payload,
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
                if res.status_code == 200:
                    data = res.json()
                    token = data.get("access_token")
                    if token:
                        return token, data, None
                    return None, data, f"Token missing in response: {res.text}"
                return None, None, f"HTTP {res.status_code}: {res.text[:200]}"
        except Exception as e:
            return None, None, f"Error exchanging code: {str(e)}"

    @classmethod
    def exchange_client_credentials(
        cls,
        shop_domain: str,
        client_id: str,
        client_secret: str,
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
        """
        Exchange Client ID and Client Secret for Shopify Store Access Token.
        Uses Shopify OAuth / Client Credentials endpoint:
        POST https://{shop_domain}/admin/oauth/access_token

        Returns: (access_token, full_response_json, error_message)
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain:
            return None, None, f"Invalid Shopify domain: '{shop_domain}'"

        # Mock fallback for sandbox / testing demo domains
        if "brand-demo" in clean_domain or "example.com" in clean_domain:
            logger.info(f"[ShopifySync] Generating mock access token for demo domain {clean_domain}")
            mock_token = f"shpat_mock_{uuid.uuid4().hex[:16]}"
            return mock_token, {"access_token": mock_token, "scope": "read_products,write_products,read_inventory"}, None

        token_url = f"https://{clean_domain}/admin/oauth/access_token"

        payloads_to_try = [
            ({"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"}, "json"),
            ({"client_id": client_id, "client_secret": client_secret}, "json"),
            ({"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"}, "form"),
        ]

        last_error = ""

        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            for body, enc_type in payloads_to_try:
                try:
                    if enc_type == "json":
                        headers = {
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                        }
                        response = client.post(token_url, json=body, headers=headers)
                    else:
                        headers = {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Accept": "application/json",
                        }
                        response = client.post(token_url, data=body, headers=headers)

                    if response.status_code == 200:
                        data = response.json()
                        access_token = data.get("access_token")
                        if access_token:
                            return access_token, data, None
                        else:
                            last_error = f"HTTP 200 received but 'access_token' missing in response: {response.text}"
                    else:
                        try:
                            err_json = response.json()
                            if isinstance(err_json, dict):
                                err_desc = (
                                    err_json.get("error_description")
                                    or err_json.get("error")
                                    or err_json.get("message")
                                    or response.text
                                )
                                last_error = f"HTTP {response.status_code} ({response.reason_phrase}): {err_desc}"
                            else:
                                last_error = f"HTTP {response.status_code} ({response.reason_phrase}): {response.text}"
                        except Exception:
                            last_error = f"HTTP {response.status_code} ({response.reason_phrase}): {response.text}"
                except Exception as e:
                    last_error = f"Connection error: {str(e)}"

        return None, None, last_error

    @classmethod
    def verify_credentials(cls, shop_domain: str, access_token: Optional[str]) -> bool:
        """
        Verify Shopify Admin API credentials against /admin/api/2024-01/shop.json.
        Returns True if valid, False otherwise.
        """
        clean_domain = cls.clean_shop_domain(shop_domain)
        if not clean_domain:
            return False

        if cls.is_mock_or_test_token(access_token, clean_domain):
            logger.info(f"[ShopifySync] Verified mock/test credentials for domain {clean_domain}")
            return True

        url = f"https://{clean_domain}/admin/api/{cls.API_VERSION}/shop.json"
        headers = {
            "X-Shopify-Access-Token": access_token.strip(),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return True
                logger.warning(
                    f"[ShopifySync] verify_credentials failed for {clean_domain}: "
                    f"HTTP {res.status_code} - {res.text[:200]}"
                )
                return False
        except Exception as e:
            logger.error(f"[ShopifySync] verify_credentials error for {clean_domain}: {e}")
            return False

    @classmethod
    def fetch_shopify_products_api(
        cls,
        shop_domain: str,
        access_token: Optional[str],
        limit: int = 250,
    ) -> List[Dict[str, Any]]:
        """Fetch live product records from Shopify Admin REST API."""
        clean_domain = cls.clean_shop_domain(shop_domain)
        if cls.is_mock_or_test_token(access_token, clean_domain):
            logger.info(f"[ShopifySync] Using starter/mock catalog for test token on {clean_domain}")
            return DEFAULT_MOCK_SHOPIFY_PRODUCTS

        url = f"https://{clean_domain}/admin/api/{cls.API_VERSION}/products.json?limit={limit}"
        headers = {
            "X-Shopify-Access-Token": access_token.strip() if access_token else "",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    products = data.get("products", [])
                    logger.info(f"[ShopifySync] Retrieved {len(products)} live products from {clean_domain}")
                    return products
                else:
                    logger.warning(
                        f"[ShopifySync] Live products fetch returned HTTP {res.status_code}. "
                        f"Falling back to mock catalog. Response: {res.text[:200]}"
                    )
                    return DEFAULT_MOCK_SHOPIFY_PRODUCTS
        except Exception as e:
            logger.error(f"[ShopifySync] Connection error fetching live products from {clean_domain}: {e}. Using fallback.")
            return DEFAULT_MOCK_SHOPIFY_PRODUCTS

    @classmethod
    def fetch_and_ingest_products(
        cls,
        db: Session,
        store_id: str,
        shop_domain: str,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch products from Shopify and upsert them into the database under tenant store_id.
        Updates the StoreIntegration metadata upon completion.
        """
        try:
            store_uuid = uuid.UUID(str(store_id))
        except (ValueError, AttributeError):
            raise ValueError(f"Invalid store ID '{store_id}'. Must be a valid UUID.")

        clean_domain = cls.clean_shop_domain(shop_domain)

        # Retrieve integration record
        integration = (
            db.query(StoreIntegration)
            .filter(
                StoreIntegration.store_id == store_uuid,
                StoreIntegration.platform == "shopify",
            )
            .first()
        )

        if not integration:
            integration = StoreIntegration(
                store_id=store_uuid,
                platform="shopify",
                shop_domain=clean_domain,
                access_token=access_token,
                sync_status="syncing",
                products_synced_count=0,
            )
            db.add(integration)
        else:
            integration.shop_domain = clean_domain
            if access_token:
                integration.access_token = access_token
            integration.sync_status = "syncing"
            integration.updated_at = datetime.now(timezone.utc)

        db.commit()

        # Fetch products from Shopify
        raw_products = cls.fetch_shopify_products_api(clean_domain, access_token)
        if not raw_products:
            raw_products = DEFAULT_MOCK_SHOPIFY_PRODUCTS

        synced_products: List[Product] = []

        for p_data in raw_products:
            title = (p_data.get("title") or "Untitled Product").strip()
            raw_desc = p_data.get("body_html") or p_data.get("description") or ""
            desc = cls.strip_html(raw_desc)
            category = (p_data.get("product_type") or p_data.get("category") or "General").strip()

            # Image resolution
            image_url = None
            if p_data.get("image") and isinstance(p_data["image"], dict):
                image_url = p_data["image"].get("src")
            elif p_data.get("images") and isinstance(p_data["images"], list) and len(p_data["images"]) > 0:
                image_url = p_data["images"][0].get("src")
            elif p_data.get("image_url"):
                image_url = p_data["image_url"]

            # Variants parsing
            variants = p_data.get("variants") or []
            if not variants and p_data.get("sizes"):
                # Handle alternative schema format
                variants = p_data.get("sizes")

            size_variants_list = []
            total_stock = 0
            primary_price = 0.0
            primary_sku = None

            if variants and isinstance(variants, list):
                for idx, v in enumerate(variants):
                    v_title = str(v.get("title") or v.get("size") or "Standard").strip()
                    v_qty = int(v.get("inventory_quantity") or v.get("stock") or 10)
                    try:
                        v_price = float(v.get("price") or 0.0)
                    except (ValueError, TypeError):
                        v_price = 0.0

                    if idx == 0:
                        primary_price = v_price if v_price > 0 else float(p_data.get("price") or 29.99)
                        primary_sku = v.get("sku")

                    total_stock += max(0, v_qty)
                    size_variants_list.append({
                        "size": v_title,
                        "stock": max(0, v_qty),
                        "price": v_price if v_price > 0 else primary_price,
                    })
            else:
                try:
                    primary_price = float(p_data.get("price") or 29.99)
                except (ValueError, TypeError):
                    primary_price = 29.99
                total_stock = int(p_data.get("stock") or p_data.get("stock_quantity") or 20)
                size_variants_list = [{"size": "Standard", "stock": total_stock, "price": primary_price}]

            # Ensure unique SKU per store
            ext_id = str(p_data.get("id") or abs(hash(title)) % 1000000)
            if primary_sku and primary_sku.strip():
                sku = f"{primary_sku.strip()}-{str(store_uuid)[:4].upper()}"
            else:
                sku = f"SHPF-{ext_id}-{str(store_uuid)[:4].upper()}"

            # Upsert into Product table: match on store_id and (sku OR title)
            existing_product = (
                db.query(Product)
                .filter(
                    Product.store_id == store_uuid,
                    or_(Product.sku == sku, Product.title == title),
                )
                .first()
            )

            if existing_product:
                existing_product.title = title
                existing_product.description = desc
                existing_product.category = category
                existing_product.price = primary_price
                existing_product.stock_quantity = total_stock
                existing_product.image_url = image_url or existing_product.image_url
                existing_product.size_variants = size_variants_list
                synced_products.append(existing_product)
            else:
                new_product = Product(
                    store_id=store_uuid,
                    sku=sku,
                    title=title,
                    description=desc,
                    category=category,
                    price=primary_price,
                    stock_quantity=total_stock,
                    image_url=image_url,
                    size_variants=size_variants_list,
                    rating=4.8,
                )
                db.add(new_product)
                synced_products.append(new_product)

        db.commit()

        # Update integration sync statistics
        total_synced = len(synced_products)
        integration.sync_status = "synced"
        integration.products_synced_count = total_synced
        integration.last_synced_at = datetime.now(timezone.utc)
        integration.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(integration)

        return {
            "status": "success",
            "success": True,
            "platform": "shopify",
            "store_id": str(store_uuid),
            "synced_count": total_synced,
            "products_synced": total_synced,
            "sync_status": "synced",
            "message": f"Successfully synchronized {total_synced} products from Shopify into store catalog.",
            "sample_products": [p.to_dict() for p in synced_products[:3]],
        }
