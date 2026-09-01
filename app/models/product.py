"""
SQLAlchemy Model for Products and Inventory Variants.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), index=True, nullable=False)
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    # size_variants stores JSON list of variant objects: e.g. [{"size": "S", "stock": 12}, {"size": "M", "stock": 8}, ...]
    size_variants = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "sku": self.sku,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "price": self.price,
            "stock_quantity": self.stock_quantity,
            "size_variants": self.size_variants,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
