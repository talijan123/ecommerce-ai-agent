"""
Database and Supabase Tool Operations for Gemini AI Function Calling.
Directly connects to Supabase PostgreSQL database via SQLAlchemy and DATABASE_URL.
"""

from app.services.db_tools import (
    track_order,
    check_product_stock,
    execute_db_tool,
    execute_supabase_tool,
    DB_TOOL_MAP,
)

SUPABASE_TOOL_MAP = DB_TOOL_MAP

__all__ = [
    "track_order",
    "check_product_stock",
    "execute_db_tool",
    "execute_supabase_tool",
    "DB_TOOL_MAP",
    "SUPABASE_TOOL_MAP",
]
