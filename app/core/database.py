"""
SQLAlchemy Database Engine, Session Factory, and Dependency Generator.
Supports PostgreSQL (Supabase / RDS) and SQLite out-of-the-box with automatic
resilience, connection pooling, and graceful fallback.
"""

import os
import re
import socket
import urllib.parse
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

IS_VERCEL = bool(os.environ.get("VERCEL"))
SQLITE_FALLBACK_URL = "sqlite:////tmp/ecommerce.db" if IS_VERCEL else "sqlite:///./ecommerce.db"


def normalize_database_url(url: str) -> str:
    """
    Sanitizes database URL, normalizes postgres:// to postgresql://,
    URL-encodes credentials with special characters, and handles
    Supabase IPv4 pooler routing if direct IPv6 connection is unreachable.
    """
    if not url:
        return SQLITE_FALLBACK_URL

    # Support postgres:// shorthand from Heroku / older Supabase links
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if not url.startswith("postgresql://"):
        return url

    # Extract user, password, host, port, db
    match = re.match(r"^postgresql://([^:]+):(.*)@([^@/:]+)(?::(\d+))?/(.+)$", url)
    if match:
        user, raw_pass, host, port, db = match.groups()
        port_num = int(port) if port else 5432
        quoted_pass = urllib.parse.quote_plus(raw_pass)

        # Handle Supabase direct domain -> transaction pooler fallback if IPv6 unreachable
        if host.startswith("db.") and host.endswith(".supabase.co"):
            project_ref = host.split(".")[1]
            try:
                socket.getaddrinfo(host, port_num, socket.AF_INET)
            except Exception:
                pooler_user = f"{user}.{project_ref}" if not user.endswith(f".{project_ref}") else user
                return f"postgresql://{pooler_user}:{quoted_pass}@aws-0-eu-central-1.pooler.supabase.com:6543/{db}"

        return f"postgresql://{user}:{quoted_pass}@{host}:{port_num}/{db}"

    return url


# Determine database URL
raw_db_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL
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
    print(f"[WARN] Failed to create PostgreSQL engine ({e}). Falling back to SQLite.")
    db_url = SQLITE_FALLBACK_URL
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def create_db_and_tables():
    """Create all database tables on configured engine."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)


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
                print("[INFO] Database empty. Seeding products...")
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
