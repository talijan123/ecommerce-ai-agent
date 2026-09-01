"""
SQLAlchemy Database Engine, Session Factory, and Dependency Generator.
Supports PostgreSQL (Supabase / RDS) and SQLite out-of-the-box.
"""

import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Configure SQLite vs PostgreSQL connect_args
connect_args = {}
db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # If running in serverless environment (e.g. Vercel / AWS Lambda) with relative sqlite path,
    # use /tmp directory where the filesystem is writable.
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        if "./ecommerce.db" in db_url or db_url == "sqlite:///ecommerce.db":
            db_url = "sqlite:////tmp/ecommerce.db"

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


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a transactional database session per request.
    Automatically closes session upon request completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
