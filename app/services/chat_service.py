"""
ChatService: Manages conversation history persistence, context retrieval, and multi-turn chat memory per session_id.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.chat import ChatHistory


class ChatService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def build_session_id(customer_phone: str, store_id: Optional[Any] = None) -> str:
        """
        Partition sessions by store_id and customer_phone.
        """
        clean_phone = "".join(c for c in str(customer_phone) if c.isdigit() or c == "+")
        if store_id:
            return f"store_{store_id}_wa_{clean_phone}"
        return f"wa_{clean_phone}"

    def get_history(
        self,
        session_id: str,
        store_id: Optional[Any] = None,
        limit: int = 15,
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent messages for a session formatted for OpenAI chat completions,
        optionally filtered by tenant store_id.
        """
        try:
            query = self.db.query(ChatHistory).filter(
                ChatHistory.session_id == session_id
            )
            if store_id is not None:
                query = query.filter(ChatHistory.store_id == store_id)

            records = query.order_by(ChatHistory.created_at.asc()).limit(limit).all()

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

    def get_gemini_history(
        self,
        session_id: str,
        store_id: Optional[Any] = None,
        limit: int = 10,
        max_inactivity_hours: float = 4.0,
    ) -> List[Dict[str, Any]]:
        """
        Fetch multi-turn conversation history formatted for Gemini generateContent contents.
        Applies context pruning (most recent 6-10 messages), active session window check
        (cleans context if user has been inactive for > 4 hours), and tenant partitioning.

        Returns:
            List[Dict[str, Any]]: List of turns e.g. [{"role": "user", "parts": [{"text": "..."}]}, {"role": "model", "parts": [{"text": "..."}]}]
        """
        try:
            # Query most recent messages for the given session and tenant
            query = self.db.query(ChatHistory).filter(ChatHistory.session_id == session_id)
            if store_id is not None:
                query = query.filter(ChatHistory.store_id == store_id)

            records = (
                query.order_by(ChatHistory.created_at.desc())
                .limit(limit)
                .all()
            )

            if not records:
                return []

            # Reverse to chronological order (oldest to newest)
            records = list(reversed(records))
            now = datetime.now(timezone.utc)

            # Inactivity Check: If the last recorded message is older than max_inactivity_hours, reset context
            last_msg_time = records[-1].created_at
            if last_msg_time:
                if last_msg_time.tzinfo is None:
                    last_msg_time = last_msg_time.replace(tzinfo=timezone.utc)
                if (now - last_msg_time).total_seconds() > max_inactivity_hours * 3600:
                    return []

            # Find cutoff index for any mid-history gap > max_inactivity_hours
            cutoff_index = 0
            for i in range(len(records)):
                rec = records[i]
                rec_time = rec.created_at
                if rec_time and i > 0:
                    prev_time = records[i - 1].created_at
                    if rec_time.tzinfo is None:
                        rec_time = rec_time.replace(tzinfo=timezone.utc)
                    if prev_time and prev_time.tzinfo is None:
                        prev_time = prev_time.replace(tzinfo=timezone.utc)
                    if prev_time and (rec_time - prev_time).total_seconds() > max_inactivity_hours * 3600:
                        cutoff_index = i

            active_records = records[cutoff_index:]

            # Format into Gemini's alternating role contents structure
            gemini_contents: List[Dict[str, Any]] = []
            for r in active_records:
                if not r.content or not str(r.content).strip():
                    continue

                # Map role to "user" or "model"
                g_role = "model" if r.role in ("assistant", "model") else "user"
                content_text = str(r.content).strip()

                # Consolidate consecutive messages with the same role
                if gemini_contents and gemini_contents[-1]["role"] == g_role:
                    prev_text = gemini_contents[-1]["parts"][0]["text"]
                    gemini_contents[-1]["parts"][0]["text"] = f"{prev_text}\n{content_text}"
                else:
                    gemini_contents.append({
                        "role": g_role,
                        "parts": [{"text": content_text}]
                    })

            return gemini_contents

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
        store_id: Optional[Any] = None,
    ) -> Optional[ChatHistory]:
        """
        Store a message or tool execution step in the database with timestamps and tenant store_id.
        """
        try:
            record = ChatHistory(
                store_id=store_id,
                session_id=session_id,
                role=role,
                content=content,
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
                name=name,
                created_at=datetime.now(timezone.utc),
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
