"""
SQLAlchemy Database Engine, Session Factory, and Dependency Generator.
Supports PostgreSQL (Supabase / RDS) and SQLite out-of-the-box.
"""

import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

IS_VERCEL = bool(os.environ.get("VERCEL"))

# Configure SQLite vs PostgreSQL connect_args
connect_args = {}
db_url = settings.DATABASE_URL

if IS_VERCEL or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    db_url = "sqlite:////tmp/ecommerce.db"

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# Fix postgresql:// vs postgres:// if provided from older Supabase/Heroku formats
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def create_db_and_tables():
    """Create all database tables."""
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)


_db_initialized = False


def ensure_db_initialized():
    """
    Ensure the database tables are created and seeded with mock products.
    Runs on startup or on the first database call.
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
                print("[INFO] Initializing and seeding database with mock products...")
                from seed_db import seed_database
                seed_database()

        _db_initialized = True
    except Exception as e:
        print(f"Database initialization warning: {e}")


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
