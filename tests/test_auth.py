"""
Unit and Integration Tests for User Authentication, Email Verification, JWT Security, and Store Ownership Isolation.
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
from app.models.user import User
from app.models.store import Store

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    ensure_db_initialized()


def create_and_verify_user(email: str, password: str = "password123", full_name: str = "Test User") -> str:
    """Helper to create and verify a test user and return their JWT access token."""
    # 1. Signup
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": password, "full_name": full_name},
    )
    assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
    verification_token = signup_res.json()["verification_token"]

    # 2. Verify Email
    verify_res = client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "verification_token": verification_token},
    )
    assert verify_res.status_code == 200, f"Verification failed: {verify_res.text}"

    # 3. Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    return login_res.json()["access_token"]


class TestUserAuthenticationAndJWT:
    """Tests covering Signup, Email Verification, Login, and Profile endpoints."""

    def test_signup_success_and_duplicate_rejection(self):
        """Test signup returns verification token and rejects duplicate emails."""
        email = f"merchant_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": email,
            "password": "SecurePassword99!",
            "full_name": "Demo Merchant",
        }

        # 1. Valid Signup
        res = client.post("/api/v1/auth/signup", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == email
        assert data["is_verified"] is False
        assert "verification_token" in data
        assert len(data["verification_token"]) >= 10

        # 2. Duplicate Signup
        dup_res = client.post("/api/v1/auth/signup", json=payload)
        assert dup_res.status_code == 409
        assert "already exists" in dup_res.json()["detail"]

    def test_verify_email_flow(self):
        """Test email verification with valid and invalid tokens."""
        email = f"verify_{uuid.uuid4().hex[:8]}@example.com"
        signup_res = client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "Password123!"},
        )
        token = signup_res.json()["verification_token"]

        # 1. Invalid Token
        bad_res = client.post(
            "/api/v1/auth/verify-email",
            json={"email": email, "verification_token": "invalid_wrong_token"},
        )
        assert bad_res.status_code == 400

        # 2. Non-existent email
        not_found_res = client.post(
            "/api/v1/auth/verify-email",
            json={"email": "non_existent_999@example.com", "verification_token": token},
        )
        assert not_found_res.status_code == 404

        # 3. Valid Token
        good_res = client.post(
            "/api/v1/auth/verify-email",
            json={"email": email, "verification_token": token},
        )
        assert good_res.status_code == 200
        assert good_res.json()["is_verified"] is True

        # 4. Repeated Verification returns idempotent success
        repeat_res = client.post(
            "/api/v1/auth/verify-email",
            json={"email": email, "verification_token": token},
        )
        assert repeat_res.status_code == 200
        assert repeat_res.json()["is_verified"] is True

    def test_login_flow_and_unverified_rejection(self):
        """Test login requires email verification and correct credentials."""
        email = f"login_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "MySecretPassword123"

        signup_res = client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": pwd},
        )
        token = signup_res.json()["verification_token"]

        # 1. Attempt login before email verification -> 403 Forbidden
        early_login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": pwd},
        )
        assert early_login.status_code == 403
        assert "not verified" in early_login.json()["detail"]

        # 2. Verify email
        client.post(
            "/api/v1/auth/verify-email",
            json={"email": email, "verification_token": token},
        )

        # 3. Wrong password -> 401 Unauthorized
        bad_pwd_login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "wrong_password_xyz"},
        )
        assert bad_pwd_login.status_code == 401

        # 4. Successful login -> 200 OK + JWT
        good_login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": pwd},
        )
        assert good_login.status_code == 200
        login_data = good_login.json()
        assert "access_token" in login_data
        assert login_data["token_type"] == "bearer"
        assert login_data["user"]["email"] == email

    def test_get_current_user_profile(self):
        """Test /auth/me profile endpoint with JWT header."""
        email = f"me_{uuid.uuid4().hex[:8]}@example.com"
        jwt_token = create_and_verify_user(email=email, full_name="Alice Merchant")

        # 1. Without Authorization header -> 401
        res_no_auth = client.get("/api/v1/auth/me")
        assert res_no_auth.status_code == 401

        # 2. With invalid token -> 401
        res_bad_auth = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
        )
        assert res_bad_auth.status_code == 401

        # 3. With valid Bearer token -> 200
        res_auth = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {jwt_token}"},
        )
        assert res_auth.status_code == 200
        profile = res_auth.json()
        assert profile["email"] == email
        assert profile["full_name"] == "Alice Merchant"
        assert profile["is_verified"] is True


class TestStoreOwnershipSecurity:
    """Tests verifying that User A cannot view, edit, or delete User B's store."""

    def test_store_ownership_isolation_between_tenants(self):
        """User A and User B can only access and modify their own stores."""
        # 1. Create two distinct authenticated merchants
        token_a = create_and_verify_user(f"user_a_{uuid.uuid4().hex[:6]}@example.com", full_name="Merchant A")
        token_b = create_and_verify_user(f"user_b_{uuid.uuid4().hex[:6]}@example.com", full_name="Merchant B")

        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 2. Merchant A creates Store A
        phone_id_a = f"wa_a_{uuid.uuid4().hex[:8]}"
        res_a = client.post(
            "/api/v1/stores",
            headers=headers_a,
            json={
                "name": "Store A - Electronics",
                "owner_email": "custom_email_a@example.com",
                "whatsapp_phone_number_id": phone_id_a,
                "whatsapp_access_token": "token_a_secret_12345",
                "system_prompt": "Prompt for Store A",
            },
        )
        assert res_a.status_code == 201
        store_a_id = res_a.json()["id"]

        # 3. Merchant B creates Store B
        phone_id_b = f"wa_b_{uuid.uuid4().hex[:8]}"
        res_b = client.post(
            "/api/v1/stores",
            headers=headers_b,
            json={
                "name": "Store B - Apparel",
                "owner_email": "custom_email_b@example.com",
                "whatsapp_phone_number_id": phone_id_b,
                "whatsapp_access_token": "token_b_secret_12345",
                "system_prompt": "Prompt for Store B",
            },
        )
        assert res_b.status_code == 201
        store_b_id = res_b.json()["id"]

        # 4. Merchant A lists stores -> sees Store A, but NOT Store B
        list_a = client.get("/api/v1/stores", headers=headers_a)
        assert list_a.status_code == 200
        stores_for_a = list_a.json()
        store_ids_for_a = [s["id"] for s in stores_for_a]
        assert store_a_id in store_ids_for_a
        assert store_b_id not in store_ids_for_a

        # 5. Merchant B lists stores -> sees Store B, but NOT Store A
        list_b = client.get("/api/v1/stores", headers=headers_b)
        assert list_b.status_code == 200
        stores_for_b = list_b.json()
        store_ids_for_b = [s["id"] for s in stores_for_b]
        assert store_b_id in store_ids_for_b
        assert store_a_id not in store_ids_for_b

        # 6. Merchant A attempts to access Store B by ID -> 404 (Not Found / Access Denied)
        cross_get = client.get(f"/api/v1/stores/{store_b_id}", headers=headers_a)
        assert cross_get.status_code == 404

        # 7. Merchant A attempts to patch Store B -> 404 (Access Denied)
        cross_patch = client.patch(
            f"/api/v1/stores/{store_b_id}",
            headers=headers_a,
            json={"name": "Hacked Store B Name"},
        )
        assert cross_patch.status_code == 404

        # 8. Merchant A attempts to delete Store B -> 404 (Access Denied)
        cross_del = client.delete(f"/api/v1/stores/{store_b_id}", headers=headers_a)
        assert cross_del.status_code == 404

        # 9. Merchant B successfully patches Store B
        good_patch = client.patch(
            f"/api/v1/stores/{store_b_id}",
            headers=headers_b,
            json={"name": "Store B - Updated Luxury Apparel"},
        )
        assert good_patch.status_code == 200
        assert good_patch.json()["name"] == "Store B - Updated Luxury Apparel"

        # 10. Merchant B successfully deletes Store B
        good_del = client.delete(f"/api/v1/stores/{store_b_id}", headers=headers_b)
        assert good_del.status_code == 200
        assert good_del.json()["is_active"] is False
