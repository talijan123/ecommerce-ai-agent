"""
Pydantic Schemas for Chat API Requests and Responses.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Unique chat session or thread ID", min_length=1)
    message: str = Field(..., description="Natural language customer query", min_length=1)
    customer_email: Optional[str] = Field(None, description="Optional customer email for auto-identification")


class ToolInvocationLog(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]
    result: Any


class ChatResponse(BaseModel):
    session_id: str
    response: str
    tools_invoked: List[ToolInvocationLog] = Field(default_factory=list)
    success: bool = True
    error: Optional[str] = None


class ChatHistoryItem(BaseModel):
    id: int
    session_id: str
    role: str
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[str] = None
