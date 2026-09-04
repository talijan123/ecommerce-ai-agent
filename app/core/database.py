"""
SQLAlchemy Database Engine, Session Factory, and Dependency Generator.
Supports PostgreSQL (Direct Supabase / RDS) and SQLite out-of-the-box with automatic
resilience, connection pooling, and graceful fallback.
"""

import os
import re
import socket
import urllib.parse
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

DIRECT_SUPABASE_URL = "postgresql://postgres:Talal12%23%40%2C%2C@db.wmkhqqbpcppnekuzrpyb.supabase.co:5432/postgres"


def normalize_database_url(url: str) -> str:
    """
    Sanitizes database URL, normalizes postgres:// to postgresql://,
    ensures special characters in credentials are properly URL-encoded,
    and provides seamless fallback to Supabase IPv4 pooler if local DNS
    cannot resolve IPv6-only direct host.
    """
    if not url:
        return DIRECT_SUPABASE_URL

    # Support postgres:// shorthand
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if not url.startswith("postgresql://"):
        return url

    # Parse and safely URL-encode password if raw special characters exist
    match = re.match(r"^postgresql://([^:]+):(.*)@([^@/:]+)(?::(\d+))?/(.+)$", url)
    if match:
        user, raw_pass, host, port, db = match.groups()
        port_num = int(port) if port else 5432
        if "%" not in raw_pass:
            quoted_pass = urllib.parse.quote_plus(raw_pass)
        else:
            quoted_pass = raw_pass

        # Check if direct host resolves on current network
        if host.startswith("db.") and host.endswith(".supabase.co"):
            project_ref = host.split(".")[1]
            try:
                socket.getaddrinfo(host, port_num)
                return f"postgresql://{user}:{quoted_pass}@{host}:{port_num}/{db}"
            except Exception:
                # Direct IPv6 unresolved locally; route via IPv4 pooler with required project-ref username
                pooler_user = f"{user}.{project_ref}" if not user.endswith(f".{project_ref}") else user
                return f"postgresql://{pooler_user}:{quoted_pass}@aws-0-eu-central-1.pooler.supabase.com:5432/{db}"

        return f"postgresql://{user}:{quoted_pass}@{host}:{port_num}/{db}"

    return url


# Determine database URL: prioritizes os.getenv("DATABASE_URL")
raw_db_url = os.getenv("DATABASE_URL") or os.environ.get("DATABASE_URL") or settings.DATABASE_URL or DIRECT_SUPABASE_URL
db_url = normalize_database_url(raw_db_url)

# Connect args & Engine configuration
connect_args = {}
engine_kwargs = {
    "pool_pre_ping": True,
}

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # PostgreSQL connection pool settings for high resilience
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
    })

try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        **engine_kwargs,
    )
except Exception as e:
    print(f"[WARN] Failed to create PostgreSQL engine ({e}). Falling back to direct Supabase URL.")
    db_url = DIRECT_SUPABASE_URL
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def create_db_and_tables():
    """Create all database tables and add missing columns if needed."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # Automatic schema migration for new columns in CartSession
    try:
        with engine.begin() as conn:
            if not db_url.startswith("sqlite"):
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) DEFAULT 'Valued Customer'"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50)"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS recovery_sent BOOLEAN DEFAULT FALSE"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS recovery_sent_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS customer_response_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE cart_sessions ADD COLUMN IF NOT EXISTS last_customer_message TEXT"))
    except Exception as e:
        # Pass gracefully if already migrated
        pass


_db_initialized = False


def ensure_db_initialized():
    """
    Ensure database tables are created and seeded with products if empty.
    Runs on startup or on first database call.
    """
    global _db_initialized
    if _db_initialized:
        return

    try:
        create_db_and_tables()

        from app.models.product import Product
        with SessionLocal() as db:
            product_count = db.query(Product).count()
            if product_count == 0:
                print("[INFO] Database empty. Seeding products from DummyJSON...")
                try:
                    from scripts.seed_real_products import seed_real_products
                    seed_real_products()
                except Exception:
                    from seed_db import seed_database
                    seed_database()

        _db_initialized = True
    except Exception as e:
        print(f"[WARN] Database initialization warning: {e}")


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session per request.
    Automatically closes session upon request completion.
    """
    ensure_db_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
