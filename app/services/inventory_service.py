"""
InventoryService: Handles database queries for product search, stock checking,
and smart out-of-stock alternative recommendations.
"""

from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.product import Product


class InventoryService:
    def __init__(self, db: Session):
        self.db = db

    def check_inventory(self, product_name: str, size: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Check product stock, price, and variant availability.
        If requested size is out of stock, automatically finds available alternative sizes and related products.
        """
        query_text = product_name.strip()
        query_words = [w for w in query_text.split() if len(w) > 2]

        # Build dynamic fuzzy query matching title, category, description, or SKU
        filters = [
            Product.title.ilike(f"%{query_text}%"),
            Product.category.ilike(f"%{query_text}%"),
            Product.sku.ilike(f"%{query_text}%"),
        ]
        for word in query_words:
            filters.append(Product.title.ilike(f"%{word}%"))
            filters.append(Product.description.ilike(f"%{word}%"))

        matching_products = self.db.query(Product).filter(or_(*filters)).all()

        if not matching_products:
            # Return category suggestions
            all_categories = [c[0] for c in self.db.query(Product.category).distinct().all()]
            return [{
                "success": False,
                "query": product_name,
                "message": f"No products found matching '{product_name}'.",
                "available_categories": all_categories,
            }]

        results: List[Dict[str, Any]] = []

        for product in matching_products:
            variants = product.size_variants or []

            if size:
                cleaned_size = size.strip().upper()
                
                # Check for the requested size in variants
                size_match = next((v for v in variants if str(v.get("size", "")).upper() == cleaned_size), None)

                # Find alternative sizes in stock
                alt_sizes = [
                    {"size": v["size"], "stock_count": v.get("stock", 0)}
                    for v in variants
                    if str(v.get("size", "")).upper() != cleaned_size and v.get("stock", 0) > 0
                ]

                if size_match:
                    stock_for_size = size_match.get("stock", 0)
                    is_in_stock = stock_for_size > 0
                    results.append({
                        "product_id": product.id,
                        "sku": product.sku,
                        "product_name": product.title,
                        "category": product.category,
                        "requested_size": size_match["size"],
                        "in_stock": is_in_stock,
                        "stock_count": stock_for_size,
                        "price": product.price,
                        "description": product.description,
                        "alternative_available_sizes": alt_sizes if not is_in_stock else [],
                        "note": "Item in requested size is currently OUT OF STOCK." if not is_in_stock else "Item is in stock and available to order."
                    })
                else:
                    # Specific size does not exist for this product
                    results.append({
                        "product_id": product.id,
                        "sku": product.sku,
                        "product_name": product.title,
                        "category": product.category,
                        "requested_size": size,
                        "in_stock": False,
                        "message": f"Size '{size}' is not offered for {product.title}.",
                        "available_variants": [{"size": v["size"], "stock_count": v.get("stock", 0), "in_stock": v.get("stock", 0) > 0} for v in variants],
                    })
            else:
                # No specific size requested; return overall product stock info
                results.append({
                    "product_id": product.id,
                    "sku": product.sku,
                    "product_name": product.title,
                    "category": product.category,
                    "price": product.price,
                    "total_stock": product.stock_quantity,
                    "in_stock": product.stock_quantity > 0,
                    "variants": variants,
                    "description": product.description,
                })

        return results
