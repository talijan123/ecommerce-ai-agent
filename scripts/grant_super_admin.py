"""
Database Script to Grant Super-Admin Privileges to aroobjan965@gmail.com.
Updates existing user record to role='super_admin' or creates verified account if not present.
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
from app.core.security import get_password_hash
from app.models.user import User


def grant_super_admin(email: str = "aroobjan965@gmail.com") -> None:
    db = SessionLocal()
    clean_email = email.strip().lower()
    try:
        user = db.query(User).filter(User.email.ilike(clean_email)).first()
        if user:
            print(f"Found existing user with ID: {user.id}, Email: {user.email}, Previous Role: {user.role}")
            user.role = "super_admin"
            user.is_verified = True
            user.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user)
            print(f"✅ Successfully updated user '{user.email}' to role='{user.role}', is_verified={user.is_verified}")
        else:
            print(f"User '{clean_email}' not found. Creating new verified super_admin account...")
            default_password_hash = get_password_hash("SuperAdmin2026!#")
            new_user = User(
                id=uuid.uuid4(),
                email=clean_email,
                hashed_password=default_password_hash,
                full_name="Aroob Jan",
                is_verified=True,
                role="super_admin",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"✅ Successfully created super_admin user '{new_user.email}' with ID: {new_user.id}, role='{new_user.role}'")

    except Exception as e:
        db.rollback()
        print(f"❌ Error updating super admin privileges: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "aroobjan965@gmail.com"
    grant_super_admin(target_email)
