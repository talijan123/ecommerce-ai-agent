"""
Pydantic Schemas for Products and Inventory.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class VariantSchema(BaseModel):
    size: str
    stock: int


class ProductBase(BaseModel):
    sku: str
    title: str
    name: Optional[str] = None
    description: Optional[str] = None
    category: str
    price: float
    stock_quantity: int = 0
    stock: Optional[int] = None
    rating: Optional[float] = 0.0
    image_url: Optional[str] = None
    size_variants: List[Dict[str, Any]] = Field(default_factory=list)


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    id: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}
