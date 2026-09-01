"""
ChatService: Manages conversation history persistence and context retrieval per session_id.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.chat import ChatHistory


class ChatService:
    def __init__(self, db: Session):
        self.db = db

    def get_history(self, session_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        """
        Fetch recent messages for a session formatted for OpenAI chat completions.
        """
        try:
            records = self.db.query(ChatHistory).filter(
                ChatHistory.session_id == session_id
            ).order_by(ChatHistory.created_at.asc()).limit(limit).all()

            formatted_messages = []
            for r in records:
                msg: Dict[str, Any] = {"role": r.role}
                if r.content:
                    msg["content"] = r.content
                if r.tool_calls:
                    msg["tool_calls"] = r.tool_calls
                if r.tool_call_id:
                    msg["tool_call_id"] = r.tool_call_id
                if r.name:
                    msg["name"] = r.name
                formatted_messages.append(msg)

            return formatted_messages
        except Exception:
            return []

    def add_message(
        self,
        session_id: str,
        role: str,
        content: Optional[str] = None,
        tool_calls: Optional[List[Dict[str, Any]]] = None,
        tool_call_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Optional[ChatHistory]:
        """
        Store a message or tool execution step in the database.
        """
        try:
            record = ChatHistory(
                session_id=session_id,
                role=role,
                content=content,
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
                name=name,
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass
            return None
