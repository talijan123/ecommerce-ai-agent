import pytest
import urllib.parse
from app.services.shopify_service import ShopifySyncService
from app.core.config import settings


class TestShopifyOAuthAndEmbed:
    """Test suite for standardized Shopify OAuth URL generation and Theme App Embed deep links."""

    def test_clean_shop_domain(self):
        # Various messy inputs
        assert ShopifySyncService.clean_shop_domain("my-brand") == "my-brand.myshopify.com"
        assert ShopifySyncService.clean_shop_domain("https://my-brand.myshopify.com/") == "my-brand.myshopify.com"
        assert ShopifySyncService.clean_shop_domain("http://MY-BRAND.myshopify.com/admin") == "my-brand.myshopify.com"
        assert ShopifySyncService.clean_shop_domain("  store-123.myshopify.com  ") == "store-123.myshopify.com"
        assert ShopifySyncService.clean_shop_domain("") == ""

    def test_extract_shop_name(self):
        assert ShopifySyncService.extract_shop_name("cool-store.myshopify.com") == "cool-store"
        assert ShopifySyncService.extract_shop_name("https://cool-store.myshopify.com/") == "cool-store"
        assert ShopifySyncService.extract_shop_name("cool-store") == "cool-store"

    def test_sanitize_scopes(self):
        # Valid comma-separated
        assert ShopifySyncService.sanitize_scopes("read_products,write_products") == "read_products,write_products"
        # Dirty scopes with whitespace and duplicate entries
        dirty = " read_products , write_products, read_products , read_orders "
        sanitized = ShopifySyncService.sanitize_scopes(dirty)
        assert sanitized == "read_products,write_products,read_orders"
        # None uses default
        assert "read_products" in ShopifySyncService.sanitize_scopes(None)

    def test_build_authorization_url_strict_format(self):
        shop = "fashion-hub.myshopify.com"
        client_id = "test_client_id_123"
        redirect_uri = "https://my-app.com/api/v1/auth/shopify/callback"
        scopes = "read_products,write_products,read_orders,read_checkouts"
        state = "state_token_abc"

        auth_url = ShopifySyncService.build_authorization_url(
            shop_domain=shop,
            client_id=client_id,
            redirect_uri=redirect_uri,
            scopes=scopes,
            state=state,
        )

        # Must strictly target https://{shop}.myshopify.com/admin/oauth/authorize
        assert auth_url.startswith(f"https://{shop}/admin/oauth/authorize?")
        assert "admin.shopify.com/store/" not in auth_url

        parsed = urllib.parse.urlparse(auth_url)
        params = urllib.parse.parse_qs(parsed.query)

        assert params["client_id"] == [client_id]
        assert params["scope"] == [scopes]
        assert params["redirect_uri"] == [redirect_uri]
        assert params["state"] == [state]

    def test_build_authorization_url_domain_sanitization(self):
        # Dirty domain with https:// and trailing slash
        auth_url = ShopifySyncService.build_authorization_url(
            shop_domain="https://messy-domain.myshopify.com/",
            client_id="cid_99",
            scopes="read_products",
            state="st1",
        )
        assert auth_url.startswith("https://messy-domain.myshopify.com/admin/oauth/authorize?")

    def test_build_theme_embed_deep_link(self):
        # With app embed extension ID
        deep_link = ShopifySyncService.build_theme_embed_deep_link(
            shop_domain="trend-store.myshopify.com",
            app_embed_extension_id="12345-67890-uuid",
        )
        assert deep_link == "https://admin.shopify.com/store/trend-store/themes/current/editor?context=apps&activateAppId=12345-67890-uuid/app-embed"

        # Fallback when no extension ID provided
        fallback_link = ShopifySyncService.build_theme_embed_deep_link(
            shop_domain="trend-store.myshopify.com",
            app_embed_extension_id="",
        )
        assert fallback_link == "https://trend-store.myshopify.com/admin/themes/current/editor?context=apps"
