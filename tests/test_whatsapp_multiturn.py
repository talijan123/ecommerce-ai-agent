"""
Unit and Integration Tests for WhatsApp Multi-Turn Conversation Memory & Context Pruning.
Verifies ChatService history formatting, 4-hour inactivity pruning, and multi-turn context resolution with Gemini AI.
"""

import os
import sys
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, ensure_db_initialized
from app.models.chat import ChatHistory
from app.services.chat_service import ChatService
from app.services.ai_support_service import AISupportService, ai_support_service
from app.api.v1.endpoints.whatsapp import handle_inbound_whatsapp_message


class TestWhatsAppMultiTurnMemory(unittest.TestCase):
    def setUp(self):
        ensure_db_initialized()
        self.db = SessionLocal()
        self.test_phone = "923991234567"
        self.session_id = f"wa_{self.test_phone}"
        # Clean test records
        self.db.query(ChatHistory).filter(ChatHistory.session_id == self.session_id).delete()
        self.db.commit()

    def tearDown(self):
        self.db.query(ChatHistory).filter(ChatHistory.session_id == self.session_id).delete()
        self.db.commit()
        self.db.close()

    def test_multi_turn_history_formatting(self):
        """Test ChatService formats messages into Gemini's alternating user/model contents structure."""
        chat_service = ChatService(self.db)

        # Add simulated past turns
        t1 = datetime.now(timezone.utc) - timedelta(minutes=10)
        t2 = datetime.now(timezone.utc) - timedelta(minutes=8)

        msg1 = ChatHistory(session_id=self.session_id, role="user", content="Nike shoes check karo", created_at=t1)
        msg2 = ChatHistory(session_id=self.session_id, role="assistant", content="Nike running shoes stock me available hain.", created_at=t2)
        self.db.add_all([msg1, msg2])
        self.db.commit()

        history = chat_service.get_gemini_history(self.session_id, limit=10, max_inactivity_hours=4.0)

        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["role"], "user")
        self.assertEqual(history[0]["parts"][0]["text"], "Nike shoes check karo")
        self.assertEqual(history[1]["role"], "model")
        self.assertEqual(history[1]["parts"][0]["text"], "Nike running shoes stock me available hain.")

    def test_context_window_limiting(self):
        """Test conversation history limits to the most recent 10 messages."""
        chat_service = ChatService(self.db)

        # Add 15 past messages
        now = datetime.now(timezone.utc)
        messages = []
        for i in range(15):
            role = "user" if i % 2 == 0 else "assistant"
            msg_time = now - timedelta(minutes=30 - i)
            messages.append(
                ChatHistory(
                    session_id=self.session_id,
                    role=role,
                    content=f"Message {i}",
                    created_at=msg_time,
                )
            )
        self.db.add_all(messages)
        self.db.commit()

        history = chat_service.get_gemini_history(self.session_id, limit=10, max_inactivity_hours=4.0)

        # Expect most recent 10 messages preserved
        self.assertLessEqual(len(history), 10)
        # Should include Message 14 (most recent)
        recent_texts = [turn["parts"][0]["text"] for turn in history]
        self.assertTrue(any("Message 14" in txt for txt in recent_texts))

    def test_inactivity_pruning_after_4_hours(self):
        """Test that conversation history is pruned if the user has been inactive for > 4 hours."""
        chat_service = ChatService(self.db)

        # Message from 5 hours ago
        old_time = datetime.now(timezone.utc) - timedelta(hours=5)
        old_msg = ChatHistory(
            session_id=self.session_id,
            role="user",
            content="Old conversation from 5 hours ago",
            created_at=old_time,
        )
        self.db.add(old_msg)
        self.db.commit()

        # Fetch history with 4-hour threshold
        history = chat_service.get_gemini_history(self.session_id, limit=10, max_inactivity_hours=4.0)

        # History should be empty because last activity was > 4 hours ago
        self.assertEqual(len(history), 0)

        # Logs in database should remain intact for audit/reporting
        all_logs = self.db.query(ChatHistory).filter(ChatHistory.session_id == self.session_id).all()
        self.assertEqual(len(all_logs), 1)

    @patch("requests.post")
    def test_followup_question_resolves_context_with_gemini(self, mock_requests_post):
        """
        Test that a follow-up question ("Aur iski price kya hai?") passes multi-turn
        conversation history to Gemini generateContent.
        """
        chat_service = ChatService(self.db)

        # 1. Seed Turn 1 into DB
        t1 = datetime.now(timezone.utc) - timedelta(minutes=3)
        t2 = datetime.now(timezone.utc) - timedelta(minutes=2)
        self.db.add_all([
            ChatHistory(session_id=self.session_id, role="user", content="Minimalist Ceramic Lamp check karo", created_at=t1),
            ChatHistory(session_id=self.session_id, role="assistant", content="Minimalist Ceramic Lamp stock me available hai! ✨", created_at=t2),
        ])
        self.db.commit()

        # 2. Mock Gemini API response for follow-up
        mock_gemini_resp = MagicMock()
        mock_gemini_resp.status_code = 200
        mock_gemini_resp.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [
                            {
                                "text": "Minimalist Ceramic Lamp ki price $85.00 hai 📦."
                            }
                        ]
                    }
                }
            ]
        }
        mock_requests_post.return_value = mock_gemini_resp

        # 3. Generate reply for follow-up turn
        history = chat_service.get_gemini_history(self.session_id, limit=10)
        reply = ai_support_service.generate_support_reply(
            customer_message="Aur iski price kya hai?",
            customer_phone=self.test_phone,
            chat_history=history,
            db=self.db,
        )

        # Verify that requests.post was called with payload containing past turns + new turn
        self.assertTrue(mock_requests_post.called)
        sent_payload = mock_requests_post.call_args[1]["json"]
        sent_contents = sent_payload["contents"]

        # Contents must contain past history turns
        self.assertGreaterEqual(len(sent_contents), 3)
        self.assertEqual(sent_contents[0]["parts"][0]["text"], "Minimalist Ceramic Lamp check karo")
        self.assertEqual(sent_contents[1]["parts"][0]["text"], "Minimalist Ceramic Lamp stock me available hai! ✨")
        self.assertIn("Aur iski price kya hai?", sent_contents[2]["parts"][0]["text"])

        # Verify final reply received
        self.assertIn("85.00", reply)

    def test_handle_inbound_whatsapp_message_persists_chat_history(self):
        """Test end-to-end handle_inbound_whatsapp_message stores both user query and AI reply in ChatHistory."""
        with patch("app.services.whatsapp_service.whatsapp_service.send_text_message") as mock_send:
            mock_send.return_value = {"success": True, "mock": True}

            asyncio.run(
                handle_inbound_whatsapp_message(
                    sender_phone=self.test_phone,
                    message_text="Hello, what are your delivery times?",
                    message_id="wamid.test_multi_turn_001",
                )
            )

        # Verify ChatHistory in database
        records = self.db.query(ChatHistory).filter(ChatHistory.session_id == self.session_id).order_by(ChatHistory.created_at.asc()).all()

        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].role, "user")
        self.assertEqual(records[0].content, "Hello, what are your delivery times?")
        self.assertEqual(records[1].role, "assistant")
        self.assertIsNotNone(records[1].content)
        self.assertIn("delivery", records[1].content.lower())


if __name__ == "__main__":
    unittest.main()
