"""
Chat Endpoints: Core conversational interface for customers and frontend widgets.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Agent Error: {str(e)}"
        )


@router.get(
    "/chat/history/{session_id}",
    response_model=List[ChatHistoryItem],
    summary="Retrieve session chat history",
    description="Fetches all previous messages and tool events recorded for the given session ID."
)
def get_chat_history(
    session_id: str,
    db: Session = Depends(get_db),
):
    records = db.query(ChatHistory).filter(
        ChatHistory.session_id == session_id
    ).order_by(ChatHistory.created_at.asc()).all()

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
