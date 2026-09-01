"""
V1 API Router Aggregator.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import chat, webhooks, admin, whatsapp

api_router = APIRouter()

api_router.include_router(chat.router, tags=["Chat & Agent"])
api_router.include_router(webhooks.router, tags=["Webhooks & Sync"])
api_router.include_router(admin.router, tags=["Merchant Admin"])
api_router.include_router(whatsapp.router, tags=["WhatsApp & Messaging"])

