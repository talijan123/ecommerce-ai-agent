"""
Pydantic Schemas for Merchant Support Tickets and Super-Admin Management.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    store_id: Optional[str] = Field(None, description="Optional Store UUID related to the issue")
    subject: str = Field(..., min_length=3, max_length=255, description="Brief summary of the issue")
    description: str = Field(..., min_length=10, description="Detailed explanation of the issue")
    category: Optional[str] = Field("general", description="Issue category: general, whatsapp, catalog, billing, bug")
    priority: Optional[str] = Field("normal", description="Priority level: low, normal, high, urgent")


class TicketStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: Open, In Progress, Resolved, Closed")
    resolution_notes: Optional[str] = Field(None, description="Super-Admin resolution explanation or merchant feedback")


class TicketResponse(BaseModel):
    id: str
    user_id: str
    store_id: Optional[str] = None
    user_email: str
    subject: str
    description: str
    category: str
    priority: str
    status: str
    resolution_notes: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None
