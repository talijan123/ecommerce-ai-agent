"""
SQLAlchemy Model for Products and Inventory Variants.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime, ForeignKey, Uuid
from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Uuid(as_uuid=True), ForeignKey("stores.id"), nullable=True, index=True)
    sku = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), index=True, nullable=False)
    price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    rating = Column(Float, default=0.0, nullable=True)
    image_url = Column(String(500), nullable=True)
    # size_variants stores JSON list of variant objects: e.g. [{"size": "S", "stock": 12}, {"size": "M", "stock": 8}, ...]
    size_variants = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __init__(self, **kwargs):
        # Allow flexible field naming
        if "name" in kwargs and "title" not in kwargs:
            kwargs["title"] = kwargs.pop("name")
        if "stock" in kwargs and "stock_quantity" not in kwargs:
            kwargs["stock_quantity"] = kwargs.pop("stock")
        if "thumbnail" in kwargs and "image_url" not in kwargs:
            kwargs["image_url"] = kwargs.pop("thumbnail")
        super().__init__(**kwargs)

    @property
    def name(self) -> str:
        return self.title

    @name.setter
    def name(self, value: str):
        self.title = value

    @property
    def stock(self) -> int:
        return self.stock_quantity

    @stock.setter
    def stock(self, value: int):
        self.stock_quantity = value

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "store_id": str(self.store_id) if self.store_id else None,
            "sku": self.sku,
            "title": self.title,
            "name": self.title,
            "description": self.description,
            "category": self.category,
            "price": self.price,
            "stock": self.stock_quantity,
            "stock_quantity": self.stock_quantity,
            "rating": self.rating or 0.0,
            "image_url": self.image_url,
            "size_variants": self.size_variants or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
