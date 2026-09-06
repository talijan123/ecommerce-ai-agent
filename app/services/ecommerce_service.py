"""
Unified E-Commerce Service for Shopify / Custom Store Live Order and Inventory Integration.
Supports both live Shopify REST Admin API and database/mock data fallback with phone-number verification.
"""

import os
import re
import uuid
import logging
import requests
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.core.database import SessionLocal
from mock_data import ORDERS, PRODUCTS

logger = logging.getLogger(__name__)


class EcommerceService:
    """
    Handles order tracking lookups, product stock availability queries,
    and phone number security validation for live Shopify and local/mock stores.
    Supports pure multi-tenant store_id resolution from database.
    """

    def __init__(
        self,
        shopify_store_url: Optional[str] = None,
        shopify_access_token: Optional[str] = None,
        shopify_api_version: Optional[str] = None,
    ):
        self.shopify_store_url = shopify_store_url or getattr(settings, "SHOPIFY_STORE_URL", "") or os.getenv("SHOPIFY_STORE_URL", "")
        self.shopify_access_token = shopify_access_token or getattr(settings, "SHOPIFY_ACCESS_TOKEN", "") or os.getenv("SHOPIFY_ACCESS_TOKEN", "")
        self.shopify_api_version = shopify_api_version or getattr(settings, "SHOPIFY_API_VERSION", "2024-01") or "2024-01"

    @property
    def is_shopify_configured(self) -> bool:
        """Check if live Shopify credentials are provided in dev fallback."""
        return bool(
            self.shopify_store_url
            and self.shopify_access_token
            and "your-shop" not in self.shopify_store_url
            and "your_" not in self.shopify_access_token
        )

    def _get_store_credentials(
        self,
        store_id: Optional[Any] = None,
        db: Optional[Session] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Retrieve store-specific Shopify domain and access token from database (store_integrations).
        Falls back to local instance/env variables only if no database record exists for that store.
        """
        if store_id:
            try:
                store_uuid = uuid.UUID(str(store_id)) if not isinstance(store_id, uuid.UUID) else store_id
                owns_db = False
                session = db
                if session is None:
                    session = SessionLocal()
                    owns_db = True
                try:
                    from app.models.integration import StoreIntegration
                    integ = (
                        session.query(StoreIntegration)
                        .filter(
                            StoreIntegration.store_id == store_uuid,
                            StoreIntegration.platform == "shopify",
                        )
                        .first()
                    )
                    if integ and integ.access_token and integ.shop_domain:
                        return integ.shop_domain, integ.access_token
                finally:
                    if owns_db:
                        session.close()
            except Exception as e:
                logger.warning(f"[EcommerceService] Error fetching store credentials for {store_id}: {e}")

        # Fallback to local dev settings
        if self.is_shopify_configured:
            return self.shopify_store_url, self.shopify_access_token

        return None, None

    @staticmethod
    def normalize_phone(phone: Optional[str]) -> str:
        """Strip all non-digit characters from a phone number string for resilient comparison."""
        if not phone:
            return ""
        return re.sub(r"\D", "", str(phone))

    @classmethod
    def phones_match(cls, phone1: Optional[str], phone2: Optional[str]) -> bool:
        """
        Check if two phone numbers match, handling international country prefixes (+92, 0092, 03xx vs 923xx, etc.).
        Matches if exact digits match or if the last 8-10 digits match.
        """
        p1 = cls.normalize_phone(phone1)
        p2 = cls.normalize_phone(phone2)

        if not p1 or not p2:
            return False

        if p1 == p2:
            return True

        # Check suffix match for last 8 to 10 significant digits
        min_len = min(len(p1), len(p2))
        if min_len >= 8:
            match_len = min(min_len, 9)
            if p1[-match_len:] == p2[-match_len:]:
                return True

        return False

    def get_order_by_number(
        self,
        order_id: str,
        phone: Optional[str] = None,
        store_id: Optional[Any] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve order status, fulfillment, carrier, tracking info, and item list by Order ID.
        Performs phone security verification if a customer phone number is provided or present on the order.

        Args:
            order_id: The order identifier (e.g., '1042', '#1043').
            phone: Optional customer's phone number for security verification.
            store_id: Optional tenant Store ID for multi-tenant routing.
            db: Optional active SQLAlchemy session.

        Returns:
            Structured dictionary with order details or security/lookup error.
        """
        if not order_id or not str(order_id).strip():
            return {
                "success": False,
                "error": "Please provide a valid Order ID (e.g., '#1042').",
                "suggested_action": "Ask customer for their order number."
            }

        cleaned_id = re.sub(r"[^\w-]", "", str(order_id)).lstrip("#").strip()

        # 1. If store has live Shopify credentials, query Shopify API
        shop_domain, access_token = self._get_store_credentials(store_id=store_id, db=db)
        if shop_domain and access_token:
            shopify_res = self._fetch_shopify_order(
                cleaned_id,
                phone=phone,
                shop_domain=shop_domain,
                access_token=access_token,
            )
            if shopify_res.get("success") or shopify_res.get("security_error"):
                return shopify_res

        # 2. Lookup from Database (Order table for tenant store_id)
        db_res = self._lookup_db_order(cleaned_id, phone=phone, store_id=store_id, db=db)
        if db_res.get("success") or db_res.get("security_error"):
            return db_res

        # 3. Fallback to mock data store
        return self._lookup_mock_order(cleaned_id, phone=phone)

    def _lookup_db_order(
        self,
        order_id: str,
        phone: Optional[str] = None,
        store_id: Optional[Any] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Lookup order from database Order table."""
        from app.models.order import Order
        owns_db = False
        session = db
        if session is None:
            session = SessionLocal()
            owns_db = True

        try:
            filters = [
                Order.order_number == order_id,
                Order.order_number.ilike(f"#{order_id}"),
                Order.order_number.ilike(order_id),
            ]
            if order_id.isdigit():
                try:
                    filters.append(Order.id == int(order_id))
                except Exception:
                    pass

            query = session.query(Order).filter(or_(*filters))
            if store_id is not None:
                try:
                    store_uuid = uuid.UUID(str(store_id)) if not isinstance(store_id, uuid.UUID) else store_id
                    query = query.filter(Order.store_id == store_uuid)
                except Exception:
                    pass

            order = query.first()
            if not order:
                return {"success": False}

            order_phone = getattr(order, "customer_phone", None)
            if not order_phone:
                for mo in ORDERS:
                    if mo.get("order_id", "").lower() == str(order_id).lower():
                        order_phone = mo.get("customer_phone")
                        break

            if phone and order_phone and not self.phones_match(phone, order_phone):
                logger.warning(
                    f"🔒 [Security Check Failed] Phone {phone} does not match order #{order_id} phone {order_phone}"
                )
                return {
                    "success": False,
                    "security_error": True,
                    "order_id": getattr(order, "order_number", order_id),
                    "error": "For security and privacy reasons, order tracking details can only be shared with the phone number registered on the order.",
                    "suggested_action": "Ask the customer to confirm the phone number or email registered when placing the order.",
                }

            return {
                "success": True,
                "order_id": getattr(order, "order_number", order_id),
                "customer_name": getattr(order, "customer_name", "Valued Customer"),
                "status": getattr(order, "status", "Processing"),
                "carrier": getattr(order, "carrier", None),
                "tracking_number": getattr(order, "tracking_number", None),
                "tracking_url": getattr(order, "tracking_url", None),
                "estimated_delivery": getattr(order, "estimated_delivery", "2-4 business days"),
                "items": getattr(order, "items", []) or [],
                "total_amount": float(getattr(order, "total_amount", 0.0) or 0.0),
                "shipping_address": getattr(order, "shipping_address", None),
                "source": "Store Database",
            }
        except Exception as e:
            logger.warning(f"[EcommerceService] Error querying DB order: {e}")
            return {"success": False}
        finally:
            if owns_db:
                session.close()

    def _fetch_shopify_order(
        self,
        order_number: str,
        phone: Optional[str] = None,
        shop_domain: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query Shopify Admin REST API for order details with security phone validation."""
        target_domain = (shop_domain or self.shopify_store_url).replace("https://", "").replace("http://", "").strip("/")
        target_token = access_token or self.shopify_access_token
        if not target_domain or not target_token:
            return {"success": False, "error": "Shopify credentials not configured."}

        url = f"https://{target_domain}/admin/api/{self.shopify_api_version}/orders.json"
        headers = {
            "X-Shopify-Access-Token": target_token,
            "Content-Type": "application/json",
        }
        params = {
            "name": f"#{order_number}" if not order_number.startswith("#") else order_number,
            "status": "any",
            "limit": 5,
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            if resp.status_code == 200:
                orders_data = resp.json().get("orders", [])
                if not orders_data:
                    # Retry searching by order_number without hash
                    params["name"] = order_number
                    resp = requests.get(url, headers=headers, params=params, timeout=10)
                    orders_data = resp.json().get("orders", []) if resp.status_code == 200 else []

                if not orders_data:
                    return {
                        "success": False,
                        "error": f"Order #{order_number} was not found in Shopify store.",
                    }

                order = orders_data[0]
                
                # Extract order phone candidates
                order_phone = (
                    order.get("phone")
                    or (order.get("customer") or {}).get("phone")
                    or (order.get("shipping_address") or {}).get("phone")
                    or (order.get("billing_address") or {}).get("phone")
                )

                # Security phone check
                if phone and order_phone and not self.phones_match(phone, order_phone):
                    logger.warning(
                        f"🔒 [Security Check Failed] Phone {phone} does not match order #{order_number} phone {order_phone}"
                    )
                    return {
                        "success": False,
                        "security_error": True,
                        "order_id": order_number,
                        "error": "For security and privacy reasons, order tracking details can only be shared with the phone number registered on the order.",
                        "suggested_action": "Ask the customer to contact support from their registered phone number or email."
                    }

                # Extract fulfillment & tracking details
                fulfillments = order.get("fulfillments", [])
                carrier = None
                tracking_number = None
                tracking_url = None
                status = "Processing"

                if fulfillments:
                    f = fulfillments[0]
                    carrier = f.get("tracking_company")
                    tracking_number = f.get("tracking_number") or (f.get("tracking_numbers", [None])[0] if f.get("tracking_numbers") else None)
                    tracking_url = f.get("tracking_url") or (f.get("tracking_urls", [None])[0] if f.get("tracking_urls") else None)
                    status = f.get("shipment_status") or f.get("status") or "Shipped"
                elif order.get("cancelled_at"):
                    status = "Cancelled"
                elif order.get("financial_status") == "paid":
                    status = "Processing"

                items = [
                    {
                        "name": li.get("name") or li.get("title"),
                        "quantity": li.get("quantity"),
                        "price": li.get("price"),
                        "variant_title": li.get("variant_title"),
                    }
                    for li in order.get("line_items", [])
                ]

                cust_name = "Valued Customer"
                if order.get("customer"):
                    c = order["customer"]
                    cust_name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip() or cust_name

                shipping_addr = None
                if order.get("shipping_address"):
                    sa = order["shipping_address"]
                    parts = [sa.get("address1"), sa.get("city"), sa.get("province"), sa.get("country")]
                    shipping_addr = ", ".join(p for p in parts if p)

                return {
                    "success": True,
                    "order_id": str(order.get("order_number") or order_number),
                    "customer_name": cust_name,
                    "status": status.capitalize() if isinstance(status, str) else "Processing",
                    "carrier": carrier,
                    "tracking_number": tracking_number,
                    "tracking_url": tracking_url,
                    "estimated_delivery": "2-4 business days" if status != "Delivered" else "Delivered",
                    "order_date": (order.get("created_at") or "")[:10],
                    "items": items,
                    "total_amount": float(order.get("total_price", 0.0)),
                    "shipping_address": shipping_addr,
                    "source": "Shopify API",
                }

            logger.warning(f"[Shopify API] Order lookup failed with HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"[Shopify API] Exception during order lookup: {e}")

        return {"success": False, "error": f"Could not retrieve order #{order_number} from Shopify."}

    def _lookup_mock_order(self, order_id: str, phone: Optional[str] = None) -> Dict[str, Any]:
        """Lookup order from mock database with phone security check."""
        for order in ORDERS:
            if order["order_id"].lower() == order_id.lower():
                order_phone = order.get("customer_phone")
                
                # Security Check: validate phone match if phone is provided and order has phone
                if phone and order_phone and not self.phones_match(phone, order_phone):
                    logger.warning(
                        f"🔒 [Security Check Failed] Phone {phone} does not match order #{order_id} phone {order_phone}"
                    )
                    return {
                        "success": False,
                        "security_error": True,
                        "order_id": order["order_id"],
                        "error": "For security and privacy reasons, order tracking details can only be shared with the phone number registered on the order.",
                        "suggested_action": "Ask the customer to confirm the phone number or email registered when placing the order."
                    }

                return {
                    "success": True,
                    "order_id": order["order_id"],
                    "customer_name": order.get("customer_name"),
                    "status": order.get("status"),
                    "carrier": order.get("carrier"),
                    "tracking_number": order.get("tracking_number"),
                    "tracking_url": order.get("tracking_url"),
                    "estimated_delivery": order.get("estimated_delivery"),
                    "order_date": order.get("order_date"),
                    "items": order.get("items", []),
                    "total_amount": order.get("total_amount"),
                    "shipping_address": order.get("shipping_address"),
                    "cancellation_reason": order.get("cancellation_reason"),
                    "source": "Store Database",
                }

        return {
            "success": False,
            "error": f"Order ID '{order_id}' was not found in our database. Please verify the order number and try again.",
            "suggested_action": "Ask customer to verify their order number or the email associated with the order."
        }

    def get_product_stock(
        self,
        query: str,
        size: Optional[str] = None,
        store_id: Optional[Any] = None,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """
        Check product stock, price, and variant availability across Shopify or store catalog.
        Provides available alternative sizes if requested variant is out of stock.

        Args:
            query: Product name or keyword (e.g., 'Classic White T-Shirt', 'Headphones').
            size: Optional size/variant code (e.g., 'S', 'M', 'L', 'XL', '10').
            store_id: Optional tenant Store ID for multi-tenant routing.
            db: Optional active SQLAlchemy session.

        Returns:
            List of matching product objects with stock counts and alternative recommendations.
        """
        if not query or not query.strip():
            return [{
                "success": False,
                "message": "Please specify a product name to check availability.",
            }]

        query_clean = query.strip()

        # 1. Check if store has live Shopify credentials
        shop_domain, access_token = self._get_store_credentials(store_id=store_id, db=db)
        if shop_domain and access_token:
            shopify_items = self._fetch_shopify_products(
                query_clean,
                size=size,
                shop_domain=shop_domain,
                access_token=access_token,
            )
            if shopify_items and shopify_items[0].get("success") is not False:
                return shopify_items

        # 2. Query Database (Product table for tenant store_id)
        db_items = self._lookup_db_products(query_clean, size=size, store_id=store_id, db=db)
        if db_items and db_items[0].get("success") is not False:
            return db_items

        # 3. Fallback to mock catalog
        return self._lookup_mock_products(query_clean, size=size)

    def _lookup_db_products(
        self,
        query: str,
        size: Optional[str] = None,
        store_id: Optional[Any] = None,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """Query products from PostgreSQL Product table for tenant store_id."""
        from app.models.product import Product
        owns_db = False
        session = db
        if session is None:
            session = SessionLocal()
            owns_db = True

        try:
            q_clean = query.strip().lower()
            stmt = session.query(Product)
            if store_id is not None:
                try:
                    store_uuid = uuid.UUID(str(store_id)) if not isinstance(store_id, uuid.UUID) else store_id
                    stmt = stmt.filter(Product.store_id == store_uuid)
                except Exception:
                    pass

            # Search by title, sku, category
            search_filters = [
                Product.title.ilike(f"%{q_clean}%"),
                Product.sku.ilike(f"%{q_clean}%"),
                Product.category.ilike(f"%{q_clean}%"),
            ]
            matching_products = stmt.filter(or_(*search_filters)).limit(10).all()

            if not matching_products:
                return []

            results: List[Dict[str, Any]] = []
            for p in matching_products:
                variants = p.size_variants or []
                prod_title = p.title

                if size:
                    cleaned_size = size.strip().upper()
                    exact_var = next(
                        (v for v in variants if str(v.get("size", "") or v.get("title", "")).upper() == cleaned_size),
                        None,
                    )
                    alt_vars = [
                        {
                            "size": v.get("size") or v.get("title"),
                            "stock_count": int(v.get("stock") or v.get("stock_count") or 0),
                            "price": float(v.get("price") or p.price),
                        }
                        for v in variants
                        if str(v.get("size", "") or v.get("title", "")).upper() != cleaned_size
                        and int(v.get("stock") or v.get("stock_count") or 0) > 0
                    ]

                    if exact_var:
                        stock = int(exact_var.get("stock") or exact_var.get("stock_count") or 0)
                        in_stock = stock > 0
                        var_price = float(exact_var.get("price") or p.price)
                        results.append({
                            "product_id": str(p.id),
                            "product_name": prod_title,
                            "sku": p.sku,
                            "category": p.category,
                            "requested_size": size,
                            "in_stock": in_stock,
                            "stock_count": stock,
                            "price": var_price,
                            "description": p.description,
                            "alternative_available_sizes": alt_vars if not in_stock else [],
                            "note": "Item is available." if in_stock else "Item in requested size is currently OUT OF STOCK.",
                            "source": "Store Database",
                        })
                    else:
                        results.append({
                            "product_id": str(p.id),
                            "product_name": prod_title,
                            "sku": p.sku,
                            "category": p.category,
                            "requested_size": size,
                            "in_stock": False,
                            "message": f"Size '{size}' is not offered or not found for {prod_title}.",
                            "available_variants": alt_vars,
                            "source": "Store Database",
                        })
                else:
                    results.append({
                        "product_id": str(p.id),
                        "product_name": prod_title,
                        "sku": p.sku,
                        "category": p.category,
                        "in_stock": (p.stock_quantity or 0) > 0,
                        "stock_count": p.stock_quantity or 0,
                        "price": float(p.price or 0.0),
                        "description": p.description,
                        "size_variants": variants,
                        "source": "Store Database",
                    })

            return results
        except Exception as e:
            logger.warning(f"[EcommerceService] Error querying DB products: {e}")
            return []
        finally:
            if owns_db:
                session.close()

    def _fetch_shopify_products(
        self,
        query: str,
        size: Optional[str] = None,
        shop_domain: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Query Shopify Admin REST API for products and variants."""
        target_domain = (shop_domain or self.shopify_store_url).replace("https://", "").replace("http://", "").strip("/")
        target_token = access_token or self.shopify_access_token
        if not target_domain or not target_token:
            return [{"success": False, "message": "Shopify credentials not configured."}]

        url = f"https://{target_domain}/admin/api/{self.shopify_api_version}/products.json"
        headers = {
            "X-Shopify-Access-Token": target_token,
            "Content-Type": "application/json",
        }
        params = {"title": query, "limit": 10}

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            if resp.status_code == 200:
                products_data = resp.json().get("products", [])
                if not products_data:
                    return [{"success": False, "message": f"No products found matching '{query}' in Shopify store."}]

                results: List[Dict[str, Any]] = []
                for p in products_data:
                    variants = p.get("variants", [])
                    prod_title = p.get("title")

                    if size:
                        cleaned_size = size.strip().upper()
                        exact_var = next((v for v in variants if str(v.get("title", "")).upper() == cleaned_size or str(v.get("option1", "")).upper() == cleaned_size), None)
                        alt_vars = [
                            {"size": v.get("title"), "stock_count": v.get("inventory_quantity", 0), "price": float(v.get("price", 0))}
                            for v in variants
                            if (v.get("title") or "").upper() != cleaned_size and (v.get("inventory_quantity", 0) or 0) > 0
                        ]

                        if exact_var:
                            stock = exact_var.get("inventory_quantity", 0) or 0
                            in_stock = stock > 0
                            results.append({
                                "product_id": str(p.get("id")),
                                "product_name": prod_title,
                                "requested_size": size,
                                "in_stock": in_stock,
                                "stock_count": stock,
                                "price": float(exact_var.get("price", 0)),
                                "alternative_available_sizes": alt_vars if not in_stock else [],
                                "note": "Item is available." if in_stock else "Item in requested size is currently OUT OF STOCK.",
                                "source": "Shopify API",
                            })
                        else:
                            results.append({
                                "product_id": str(p.get("id")),
                                "product_name": prod_title,
                                "requested_size": size,
                                "in_stock": False,
                                "message": f"Variant '{size}' is not available for {prod_title}.",
                                "available_variants": alt_vars,
                                "source": "Shopify API",
                            })
                    else:
                        for v in variants:
                            stock = v.get("inventory_quantity", 0) or 0
                            results.append({
                                "product_id": str(p.get("id")),
                                "product_name": prod_title,
                                "size": v.get("title"),
                                "in_stock": stock > 0,
                                "stock_count": stock,
                                "price": float(v.get("price", 0)),
                                "source": "Shopify API",
                            })

                return results if results else [{"success": False, "message": f"No variants found for '{query}'."}]

            logger.warning(f"[Shopify API] Product lookup returned HTTP {resp.status_code}")
        except Exception as e:
            logger.warning(f"[Shopify API] Exception during product lookup: {e}")

        return [{"success": False, "message": f"Error querying Shopify products for '{query}'."}]

    def _lookup_mock_products(self, query: str, size: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lookup products from catalog with alternative out-of-stock recommendations."""
        query_lower = query.lower().strip()

        matching_products = [
            p for p in PRODUCTS
            if query_lower in p["name"].lower() or query_lower in p.get("category", "").lower()
        ]

        if not matching_products:
            query_words = set(query_lower.split())
            matching_products = [
                p for p in PRODUCTS
                if any(word in p["name"].lower().split() for word in query_words)
            ]

        if not matching_products:
            return [{
                "success": False,
                "query": query,
                "message": f"No products found matching '{query}'.",
                "available_categories": list({p.get('category', '') for p in PRODUCTS if p.get('category')}),
            }]

        results: List[Dict[str, Any]] = []

        if size:
            cleaned_size = size.strip().upper()
            exact_size_matches = [
                p for p in matching_products
                if str(p.get("size", "")).upper() == cleaned_size
            ]

            available_other_sizes = [
                {"size": p["size"], "stock_count": p["stock_count"], "price": p["price"]}
                for p in matching_products
                if str(p.get("size", "")).upper() != cleaned_size and p["stock_count"] > 0
            ]

            if exact_size_matches:
                for item in exact_size_matches:
                    is_in_stock = item["stock_count"] > 0
                    results.append({
                        "product_id": item["id"],
                        "product_name": item["name"],
                        "category": item.get("category"),
                        "requested_size": item["size"],
                        "in_stock": is_in_stock,
                        "stock_count": item["stock_count"],
                        "price": item["price"],
                        "description": item.get("description"),
                        "alternative_available_sizes": available_other_sizes if not is_in_stock else [],
                        "note": "Item is available." if is_in_stock else "Item in requested size is currently OUT OF STOCK.",
                        "source": "Catalog Database",
                    })
            else:
                all_sizes = [
                    {"size": p["size"], "stock_count": p["stock_count"], "in_stock": p["stock_count"] > 0}
                    for p in matching_products
                ]
                results.append({
                    "product_name": matching_products[0]["name"],
                    "requested_size": size,
                    "in_stock": False,
                    "message": f"Size '{size}' is not offered or not found for {matching_products[0]['name']}.",
                    "available_variants": all_sizes,
                    "source": "Catalog Database",
                })
        else:
            for item in matching_products:
                results.append({
                    "product_id": item["id"],
                    "product_name": item["name"],
                    "category": item.get("category"),
                    "size": item.get("size"),
                    "in_stock": item["stock_count"] > 0,
                    "stock_count": item["stock_count"],
                    "price": item["price"],
                    "description": item.get("description"),
                    "source": "Catalog Database",
                })

        return results


# Global singleton instance
ecommerce_service = EcommerceService()
