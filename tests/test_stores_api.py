"""
Integration & Unit Tests for Multi-Tenant Store Onboarding & Tenant Management REST APIs.
Tests /api/v1/stores endpoints for CRUD operations, validation, credential masking, and duplicate detection.
"""

import sys
import os
import uuid
import pytest
from fastapi.testclient import TestClient

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


class TestStoreManagementAPIs:
    """Test suite covering /api/v1/stores CRUD endpoints."""

    def test_create_store_success_and_token_masking(self):
        """Test creating a new tenant store returns 201 with masked access token."""
        unique_phone_id = f"test_pid_{uuid.uuid4().hex[:10]}"
        raw_token = "EAATL7gIMUisBSV2esJYH2oAvUts7uVOkq02Kk79EovmQLqCSUZBXoNlJnb2Nx"

        payload = {
            "name": "Acme Fashion Store",
            "owner_email": "owner@acmefashion.com",
            "whatsapp_phone_number_id": unique_phone_id,
            "whatsapp_access_token": raw_token,
            "system_prompt": "You are Acme Fashion's high-end stylist assistant.",
        }

        response = client.post("/api/v1/stores", json=payload)
        assert response.status_code == 201, f"Failed: {response.text}"
        data = response.json()

        assert "id" in data
        assert data["name"] == "Acme Fashion Store"
        assert data["owner_email"] == "owner@acmefashion.com"
        assert data["whatsapp_phone_number_id"] == unique_phone_id
        assert data["system_prompt"] == "You are Acme Fashion's high-end stylist assistant."
        assert data["is_active"] is True
        assert data["has_access_token"] is True
        assert "masked_access_token" in data
        assert raw_token not in str(data)  # Raw secret must NEVER be exposed
        assert data["masked_access_token"].startswith("EAATL7")
        assert data["masked_access_token"].endswith("b2Nx")

    def test_create_store_duplicate_phone_id_rejection(self):
        """Test duplicate whatsapp_phone_number_id returns 409 Conflict."""
        duplicate_phone_id = f"dup_pid_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": "First Tenant",
            "owner_email": "tenant1@example.com",
            "whatsapp_phone_number_id": duplicate_phone_id,
            "whatsapp_access_token": "token_tenant_1",
        }

        # First registration succeeds
        res1 = client.post("/api/v1/stores", json=payload)
        assert res1.status_code == 201

        # Second registration with same phone ID fails
        res2 = client.post(
            "/api/v1/stores",
            json={
                "name": "Second Tenant Impostor",
                "owner_email": "tenant2@example.com",
                "whatsapp_phone_number_id": duplicate_phone_id,
                "whatsapp_access_token": "token_tenant_2",
            },
        )
        assert res2.status_code == 409
        assert "already registered" in res2.json()["detail"]

    def test_create_store_validation_errors(self):
        """Test input validation for invalid email and short names."""
        bad_payload = {
            "name": "A",  # min length is 2
            "owner_email": "not-an-email",
            "whatsapp_phone_number_id": "123",
            "whatsapp_access_token": "token",
        }
        res = client.post("/api/v1/stores", json=bad_payload)
        assert res.status_code == 422

    def test_list_stores_with_pagination(self):
        """Test listing stores and pagination options."""
        res = client.get("/api/v1/stores?skip=0&limit=5")
        assert res.status_code == 200
        stores = res.json()
        assert isinstance(stores, list)
        assert len(stores) >= 1
        for s in stores:
            assert "id" in s
            assert "name" in s
            assert "whatsapp_phone_number_id" in s
            assert "masked_access_token" in s
            assert "whatsapp_access_token" not in s

    def test_get_store_by_id_success_and_404(self):
        """Test retrieving specific store details by ID."""
        phone_id = f"get_pid_{uuid.uuid4().hex[:8]}"
        res = client.post(
            "/api/v1/stores",
            json={
                "name": "Lookup Test Store",
                "owner_email": "lookup@example.com",
                "whatsapp_phone_number_id": phone_id,
                "whatsapp_access_token": "token_lookup_12345",
            },
        )
        assert res.status_code == 201
        store_id = res.json()["id"]

        # Valid ID lookup
        get_res = client.get(f"/api/v1/stores/{store_id}")
        assert get_res.status_code == 200
        assert get_res.json()["name"] == "Lookup Test Store"

        # Non-existent UUID
        random_id = str(uuid.uuid4())
        not_found_res = client.get(f"/api/v1/stores/{random_id}")
        assert not_found_res.status_code == 404

        # Invalid UUID format
        invalid_res = client.get("/api/v1/stores/not-a-valid-uuid")
        assert invalid_res.status_code == 404

    def test_patch_store_fields(self):
        """Test updating store prompt, name, and access token."""
        phone_id = f"patch_pid_{uuid.uuid4().hex[:8]}"
        res = client.post(
            "/api/v1/stores",
            json={
                "name": "Original Name",
                "owner_email": "patch@example.com",
                "whatsapp_phone_number_id": phone_id,
                "whatsapp_access_token": "token_old_1111111111",
                "system_prompt": "Old prompt",
            },
        )
        assert res.status_code == 201
        store_id = res.json()["id"]

        # Update name and prompt
        patch_res = client.patch(
            f"/api/v1/stores/{store_id}",
            json={
                "name": "Updated Brand Name",
                "system_prompt": "New updated AI prompt with luxury tone.",
                "whatsapp_access_token": "token_new_9999999999",
            },
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["name"] == "Updated Brand Name"
        assert updated["system_prompt"] == "New updated AI prompt with luxury tone."
        assert updated["masked_access_token"].startswith("token_")
        assert updated["masked_access_token"].endswith("9999")

    def test_soft_delete_store(self):
        """Test soft deleting / deactivating a store tenant."""
        phone_id = f"del_pid_{uuid.uuid4().hex[:8]}"
        res = client.post(
            "/api/v1/stores",
            json={
                "name": "To Be Deleted Store",
                "owner_email": "delete@example.com",
                "whatsapp_phone_number_id": phone_id,
                "whatsapp_access_token": "token_delete_12345",
            },
        )
        assert res.status_code == 201
        store_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/stores/{store_id}")
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True
        assert del_res.json()["is_active"] is False

        # Verify through GET that it is now inactive
        check_res = client.get(f"/api/v1/stores/{store_id}")
        assert check_res.status_code == 200
        assert check_res.json()["is_active"] is False
