"""
Database bridge module.
Provides direct access to engine, SessionLocal, Base, get_db, and ensure_db_initialized.
"""

from app.core.database import (
    engine,
    SessionLocal,
    Base,
    get_db,
    create_db_and_tables,
    ensure_db_initialized,
    normalize_database_url,
    DIRECT_SUPABASE_URL,
)

__all__ = [
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "create_db_and_tables",
    "ensure_db_initialized",
    "normalize_database_url",
    "DIRECT_SUPABASE_URL",
]
