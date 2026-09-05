"""
Script to set a direct known password for aroobjan965@gmail.com and ensure super_admin role and verified status.
"""

import os
import sys
import uuid
from datetime import datetime, timezone

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

from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.models.user import User


def set_user_password(email: str = "aroobjan965@gmail.com", password: str = "Admin@12345") -> None:
    db = SessionLocal()
    clean_email = email.strip().lower()
    try:
        user = db.query(User).filter(User.email.ilike(clean_email)).first()
        hashed = get_password_hash(password)

        if user:
            print(f"Found existing user with ID: {user.id}, Email: {user.email}")
            user.hashed_password = hashed
            user.is_verified = True
            user.role = "super_admin"
            user.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user)
            print(f"✅ Successfully updated password for '{user.email}'")
            print(f"   Role: {user.role}")
            print(f"   Is Verified: {user.is_verified}")
            print(f"   Password verification test: {verify_password(password, user.hashed_password)}")
        else:
            print(f"User '{clean_email}' not found. Creating user with super_admin role...")
            user = User(
                id=uuid.uuid4(),
                email=clean_email,
                hashed_password=hashed,
                full_name="Aroob Jan",
                is_verified=True,
                role="super_admin",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Successfully created user '{user.email}' with ID: {user.id}")
            print(f"   Role: {user.role}")
            print(f"   Is Verified: {user.is_verified}")
            print(f"   Password verification test: {verify_password(password, user.hashed_password)}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error setting user password: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "aroobjan965@gmail.com"
    target_password = sys.argv[2] if len(sys.argv) > 2 else "Admin@12345"
    set_user_password(target_email, target_password)
