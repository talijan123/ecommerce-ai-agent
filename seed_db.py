"""
Database Seeding Script: Automatically initializes and populates the database
with 100 real products from DummyJSON along with demo orders and abandoned cart sessions.
"""

import sys

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from scripts.seed_real_products import seed_real_products


def seed_database():
    """Seed real products and demo data."""
    seed_real_products()


if __name__ == "__main__":
    seed_database()
