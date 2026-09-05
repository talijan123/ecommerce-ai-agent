"""
SQLAlchemy Model for Store Integrations (Shopify, WooCommerce, Custom API).
Stores platform credentials, connection status, shop domain, and sync metadata.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Text, Integer, DateTime, Uuid, ForeignKey
from app.core.database import Base


class StoreIntegration(Base):
    __tablename__ = "store_integrations"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    store_id = Column(Uuid(as_uuid=True), ForeignKey("stores.id"), nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)  # 'shopify', 'woocommerce', 'custom_api'
    shop_domain = Column(String(255), nullable=True)  # e.g. 'store.myshopify.com'
    api_key = Column(String(500), nullable=True)
    access_token = Column(Text, nullable=True)
    sync_status = Column(String(50), default="connected", nullable=False)  # 'pending', 'syncing', 'synced', 'failed'
    products_synced_count = Column(Integer, default=0, nullable=False)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id) if self.id else None,
            "store_id": str(self.store_id) if self.store_id else None,
            "platform": self.platform,
            "shop_domain": self.shop_domain,
            "sync_status": self.sync_status,
            "products_synced_count": self.products_synced_count,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": (self.updated_at or self.created_at).isoformat() if (self.updated_at or self.created_at) else None,
        }
