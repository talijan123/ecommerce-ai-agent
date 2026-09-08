import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.agent import run_agent_turn
from app.schemas.chat import ChatRequest, ChatResponse, ChatHistoryItem, ToolInvocationLog
from app.models.chat import ChatHistory

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Send a message to the Autonomous E-Commerce AI Agent",
    description="Accepts customer queries, performs tool calling against store databases, and returns an accurate synthesized response."
)
def send_chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    """
    Execute an autonomous agent conversation turn.
    """
    try:
        response_text, tools_invoked, success = run_agent_turn(
            db=db,
            session_id=payload.session_id,
            user_message=payload.message,
            customer_email=payload.customer_email,
            store_id=payload.store_id,
            shop_domain=payload.shop_domain,
        )

        formatted_tools = [
            ToolInvocationLog(
                tool_name=t["tool_name"],
                arguments=t["arguments"],
                result=t["result"]
            )
            for t in tools_invoked
        ]

        return ChatResponse(
            session_id=payload.session_id,
            response=response_text,
            tools_invoked=formatted_tools,
            success=success,
            error=None if success else response_text,
        )

    except Exception as e:
        return ChatResponse(
            session_id=payload.session_id,
            response=f"⚠️ Notice: Unable to complete conversation turn ({str(e)}). Please verify backend environment configuration.",
            tools_invoked=[],
            success=False,
            error=str(e),
        )


@router.get(
    "/chat/history/{session_id}",
    response_model=List[ChatHistoryItem],
    summary="Retrieve session chat history",
    description="Fetches all previous messages and tool events recorded for the given session ID, optionally filtered by tenant store_id."
)
def get_chat_history(
    session_id: str,
    store_id: Optional[str] = Query(None, description="Optional tenant store UUID filter"),
    db: Session = Depends(get_db),
):
    query = db.query(ChatHistory).filter(ChatHistory.session_id == session_id)
    if store_id:
        try:
            parsed_uuid = uuid.UUID(store_id.strip())
            query = query.filter(ChatHistory.store_id == parsed_uuid)
        except (ValueError, AttributeError):
            return []

    records = query.order_by(ChatHistory.created_at.asc()).all()

    return [
        ChatHistoryItem(
            id=r.id,
            session_id=r.session_id,
            role=r.role,
            content=r.content,
            tool_calls=r.tool_calls,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in records
    ]
