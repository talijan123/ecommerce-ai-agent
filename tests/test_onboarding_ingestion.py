"""
Unit and Integration Tests for Product CSV Ingestion and WhatsApp Connection Verification.
Tests template download, CSV parsing with variant generation, store scoping, and Meta API verification.
"""

import sys
import os
import io
import uuid
import pytest
from unittest.mock import patch, AsyncMock
import httpx
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.product import Product
from app.models.store import Store
from tests.test_auth import create_and_verify_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


@pytest.fixture
def test_merchant():
    """Create a verified test merchant, store, and auth headers."""
    email = f"ingest_{uuid.uuid4().hex[:8]}@example.com"
    token = create_and_verify_user(email=email, full_name="Ingest Merchant")
    headers = {"Authorization": f"Bearer {token}"}

    phone_id = f"wa_ingest_{uuid.uuid4().hex[:8]}"
    store_res = client.post(
        "/api/v1/stores",
        headers=headers,
        json={
            "name": "Ingestion Demo Store",
            "owner_email": email,
            "whatsapp_phone_number_id": phone_id,
            "whatsapp_access_token": "token_ingest_secret_9999",
            "system_prompt": "You are a professional catalog assistant.",
        },
    )
    assert store_res.status_code == 201
    store_data = store_res.json()

    return {
        "email": email,
        "token": token,
        "headers": headers,
        "store_id": store_data["id"],
        "phone_id": phone_id,
    }


class TestProductCSVIngestion:
    """Tests covering sample CSV download and bulk product CSV upload."""

    def test_download_sample_products_csv(self):
        """Test downloading the sample CSV template."""
        res = client.get("/api/v1/stores/sample-products-csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers.get("content-type", "")
        assert "sample_products_template.csv" in res.headers.get("content-disposition", "")
        content = res.text
        assert "sku,title,price,stock_quantity,category,description" in content
        assert "Classic Heavyweight Cotton T-Shirt" in content
        assert "Velocity Cloud Pro Running Shoes" in content

    def test_upload_products_csv_success(self, test_merchant):
        """Test uploading a valid CSV creates products tied to merchant's store_id."""
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]

        csv_data = (
            "sku,title,price,stock_quantity,category,description\n"
            f"TEST-TEE-{uuid.uuid4().hex[:4]},Crewneck Cotton T-Shirt,29.99,100,Apparel,Soft cotton tee\n"
            f"TEST-SHOE-{uuid.uuid4().hex[:4]},Aero Dynamic Sneakers,89.50,60,Footwear,Mesh running shoes\n"
            f"TEST-PERF-{uuid.uuid4().hex[:4]},Rose & Vanilla Perfume,54.00,30,Fragrance,Luxury 50ml EDP\n"
            ",Generic Sunglasses,19.99,45,Accessories,UV400 Polarized Shades\n"
        )

        files = {
            "file": ("test_catalog.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")
        }

        res = client.post(
            f"/api/v1/stores/{store_id}/products/upload-csv",
            headers=headers,
            files=files,
        )
        assert res.status_code == 200, f"Upload failed: {res.text}"
        data = res.json()

        assert data["total_rows"] == 4
        assert data["imported"] == 4
        assert len(data["errors"]) == 0
        assert len(data["sample_imported"]) == 4

        # Verify products in database have store_id set
        db = SessionLocal()
        try:
            db_prods = db.query(Product).filter(Product.store_id == uuid.UUID(store_id)).all()
            assert len(db_prods) >= 4
            apparel_item = next((p for p in db_prods if p.title == "Crewneck Cotton T-Shirt"), None)
            assert apparel_item is not None
            assert apparel_item.price == 29.99
            assert len(apparel_item.size_variants) == 5  # XS, S, M, L, XL
        finally:
            db.close()

    def test_upload_products_csv_handles_errors_gracefully(self, test_merchant):
        """Test CSV with some invalid rows imports valid ones and logs non-fatal row errors."""
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]

        mixed_csv = (
            "title,price,stock_quantity,category\n"
            "Valid Summer Dress,49.99,50,Apparel\n"
            ",25.00,10,Accessories\n"  # Missing title
            "Bad Price Jacket,invalid_number,20,Apparel\n"  # Bad price
            "Valid Leather Belt,35.00,40,Accessories\n"
        )

        files = {
            "file": ("mixed_catalog.csv", io.BytesIO(mixed_csv.encode("utf-8")), "text/csv")
        }

        res = client.post(
            f"/api/v1/stores/{store_id}/products/upload-csv",
            headers=headers,
            files=files,
        )
        assert res.status_code == 200
        data = res.json()

        assert data["total_rows"] == 4
        assert data["imported"] == 2
        assert len(data["errors"]) == 2
        assert any("Missing product title" in e for e in data["errors"])
        assert any("Invalid price value" in e for e in data["errors"])

    def test_upload_products_csv_cross_store_rejection(self, test_merchant):
        """Test User A cannot upload CSV to User B's store."""
        store_id_a = test_merchant["store_id"]

        # Create User B
        email_b = f"intruder_{uuid.uuid4().hex[:8]}@example.com"
        token_b = create_and_verify_user(email=email_b, full_name="User B")
        headers_b = {"Authorization": f"Bearer {token_b}"}

        files = {
            "file": ("cross_catalog.csv", io.BytesIO(b"title,price\nHacked Item,10.00"), "text/csv")
        }

        res = client.post(
            f"/api/v1/stores/{store_id_a}/products/upload-csv",
            headers=headers_b,
            files=files,
        )
        assert res.status_code == 404  # Access denied / not found


class TestWhatsAppConnectionVerification:
    """Tests covering Meta WhatsApp Cloud API connection verification."""

    def test_verify_whatsapp_connection_success(self, test_merchant):
        """Test successful Meta connection verification updates store status."""
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]
        unique_phone_id = f"meta_phone_{uuid.uuid4().hex[:10]}"

        mock_meta_response = httpx.Response(
            status_code=200,
            json={
                "verified_name": "Acme Official Store",
                "display_phone_number": "+1 (555) 019-2834",
                "quality_rating": "GREEN",
                "code_verification_status": "VERIFIED",
            },
            request=httpx.Request("GET", f"https://graph.facebook.com/v21.0/{unique_phone_id}"),
        )

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_meta_response

            res = client.post(
                f"/api/v1/stores/{store_id}/verify-whatsapp",
                headers=headers,
                json={
                    "whatsapp_phone_number_id": unique_phone_id,
                    "whatsapp_access_token": "EAAT_valid_token_test_12345",
                },
            )

            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "connected"
            assert data["verified_name"] == "Acme Official Store"
            assert data["display_phone_number"] == "+1 (555) 019-2834"

    def test_verify_whatsapp_connection_failure(self, test_merchant):
        """Test invalid Meta credentials return failed status with details."""
        store_id = test_merchant["store_id"]
        headers = test_merchant["headers"]

        mock_meta_error_response = httpx.Response(
            status_code=400,
            json={
                "error": {
                    "message": "Invalid OAuth access token - Cannot parse access token",
                    "type": "OAuthException",
                    "code": 190,
                }
            },
            request=httpx.Request("GET", "https://graph.facebook.com/v21.0/bad_phone_id"),
        )

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_meta_error_response

            res = client.post(
                f"/api/v1/stores/{store_id}/verify-whatsapp",
                headers=headers,
                json={
                    "whatsapp_phone_number_id": "bad_phone_id",
                    "whatsapp_access_token": "bad_access_token",
                },
            )

            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "failed"
            assert "Invalid Meta credentials" in data["error"]

    def test_verify_whatsapp_cross_store_denied(self, test_merchant):
        """Test User A cannot run WhatsApp verification on User B's store."""
        store_id_a = test_merchant["store_id"]

        # Create User B
        email_b = f"merchant_b_{uuid.uuid4().hex[:8]}@example.com"
        token_b = create_and_verify_user(email=email_b, full_name="User B")
        headers_b = {"Authorization": f"Bearer {token_b}"}

        res = client.post(
            f"/api/v1/stores/{store_id_a}/verify-whatsapp",
            headers=headers_b,
            json={"whatsapp_access_token": "token"},
        )
        assert res.status_code == 404

