"""
SQLAlchemy Model for Chat History and Conversation Context Persistence.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, Uuid
from app.core.database import Base


class ChatHistory(Base):
    __tablename__ = "chat_histories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Uuid(as_uuid=True), ForeignKey("stores.id"), nullable=True, index=True)
    session_id = Column(String(100), index=True, nullable=False)
    role = Column(String(20), nullable=False)  # "system", "user", "assistant", "tool"
    content = Column(Text, nullable=True)
    tool_calls = Column(JSON, nullable=True)  # Assistant tool calls JSON if any
    tool_call_id = Column(String(100), nullable=True)  # Tool call id for tool role
    name = Column(String(100), nullable=True)  # Function name for tool role
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "store_id": str(self.store_id) if self.store_id else None,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "tool_calls": self.tool_calls,
            "tool_call_id": self.tool_call_id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
