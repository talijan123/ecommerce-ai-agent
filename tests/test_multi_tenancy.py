"""
Unit and Integration Tests for SaaS WhatsApp Multi-Tenancy Architecture.
Verifies:
1. Multi-Tenant database models (Store UUID, Order/Product/ChatHistory foreign keys).
2. Dynamic Meta Webhook routing based on metadata.phone_number_id.
3. Strict tenant isolation for Order tracking (no data leakage across stores).
4. Strict tenant isolation for Product catalog search (no stock leakage across stores).
5. ChatHistory conversation memory partitioning per store_id and customer_phone.
6. Unmatched or inactive phone_number_id handling (returns 200 OK without errors).
"""

import os
import sys
import uuid
import asyncio
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, ensure_db_initialized
from app.models.store import Store
from app.models.product import Product
from app.models.order import Order
from app.models.chat import ChatHistory
from app.services.db_tools import track_order, check_product_stock, execute_db_tool
from app.services.chat_service import ChatService
from app.api.v1.endpoints.whatsapp import handle_inbound_whatsapp_message


class TestMultiTenancyArchitecture(unittest.TestCase):
    def setUp(self):
        ensure_db_initialized()
        self.db = SessionLocal()
        self.client = TestClient(app)

        # Unique IDs for clean test isolation
        self.unique_suffix = uuid.uuid4().hex[:8]
        self.phone_id_a = f"phone_a_{self.unique_suffix}"
        self.phone_id_b = f"phone_b_{self.unique_suffix}"
        self.phone_id_inactive = f"phone_inactive_{self.unique_suffix}"

        # Create Store A (Active)
        self.store_a = Store(
            name=f"Store Alpha {self.unique_suffix}",
            owner_email=f"alpha_{self.unique_suffix}@example.com",
            whatsapp_phone_number_id=self.phone_id_a,
            whatsapp_access_token=f"token_alpha_{self.unique_suffix}",
            system_prompt="You are a luxury fashion assistant for Store Alpha.",
            is_active=True,
        )

        # Create Store B (Active)
        self.store_b = Store(
            name=f"Store Beta {self.unique_suffix}",
            owner_email=f"beta_{self.unique_suffix}@example.com",
            whatsapp_phone_number_id=self.phone_id_b,
            whatsapp_access_token=f"token_beta_{self.unique_suffix}",
            system_prompt="You are a tech gadget assistant for Store Beta.",
            is_active=True,
        )

        # Create Store Inactive
        self.store_inactive = Store(
            name=f"Store Inactive {self.unique_suffix}",
            owner_email=f"inactive_{self.unique_suffix}@example.com",
            whatsapp_phone_number_id=self.phone_id_inactive,
            whatsapp_access_token=f"token_inactive_{self.unique_suffix}",
            system_prompt="Inactive store bot",
            is_active=False,
        )

        self.db.add_all([self.store_a, self.store_b, self.store_inactive])
        self.db.commit()
        self.db.refresh(self.store_a)
        self.db.refresh(self.store_b)
        self.db.refresh(self.store_inactive)

    def tearDown(self):
        try:
            # Clean up test records
            self.db.query(ChatHistory).filter(
                ChatHistory.store_id.in_([self.store_a.id, self.store_b.id, self.store_inactive.id])
            ).delete(synchronize_session=False)

            self.db.query(Order).filter(
                Order.store_id.in_([self.store_a.id, self.store_b.id, self.store_inactive.id])
            ).delete(synchronize_session=False)

            self.db.query(Product).filter(
                Product.store_id.in_([self.store_a.id, self.store_b.id, self.store_inactive.id])
            ).delete(synchronize_session=False)

            self.db.query(Store).filter(
                Store.id.in_([self.store_a.id, self.store_b.id, self.store_inactive.id])
            ).delete(synchronize_session=False)

            self.db.commit()
        except Exception:
            self.db.rollback()
        finally:
            self.db.close()

    def test_store_model_schema_and_serialization(self):
        """Verify Store model UUID primary key, fields, and to_dict serialization."""
        self.assertIsInstance(self.store_a.id, uuid.UUID)
        self.assertEqual(self.store_a.whatsapp_phone_number_id, self.phone_id_a)
        self.assertTrue(self.store_a.is_active)
        self.assertFalse(self.store_inactive.is_active)

        store_dict = self.store_a.to_dict()
        self.assertEqual(store_dict["id"], str(self.store_a.id))
        self.assertEqual(store_dict["name"], self.store_a.name)
        self.assertEqual(store_dict["whatsapp_phone_number_id"], self.phone_id_a)
        self.assertEqual(store_dict["system_prompt"], "You are a luxury fashion assistant for Store Alpha.")

    def test_webhook_routes_to_correct_tenant_based_on_phone_number_id(self):
        """Verify inbound webhook inspects metadata.phone_number_id and schedules task with matching tenant credentials."""
        with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
            # 1. Payload targeting Store A
            payload_a = {
                "object": "whatsapp_business_account",
                "entry": [
                    {
                        "id": "WABA_ID",
                        "changes": [
                            {
                                "value": {
                                    "messaging_product": "whatsapp",
                                    "metadata": {
                                        "display_phone_number": "15550001",
                                        "phone_number_id": self.phone_id_a,
                                    },
                                    "messages": [
                                        {
                                            "from": "923001111111",
                                            "id": "wamid.msg_alpha_01",
                                            "text": {"body": "Hi Alpha store!"},
                                            "type": "text",
                                        }
                                    ],
                                },
                                "field": "messages",
                            }
                        ],
                    }
                ],
            }

            resp_a = self.client.post("/api/v1/webhooks/whatsapp", json=payload_a)
            self.assertEqual(resp_a.status_code, 200)
            self.assertEqual(resp_a.json(), {"status": "EVENT_RECEIVED"})

            # Verify background task was scheduled with Store A's store_id & credentials
            self.assertTrue(mock_add_task.called)
            call_args = mock_add_task.call_args[1]
            self.assertEqual(call_args["sender_phone"], "923001111111")
            self.assertEqual(call_args["message_text"], "Hi Alpha store!")
            self.assertEqual(call_args["store_id"], self.store_a.id)
            self.assertEqual(call_args["system_prompt"], self.store_a.system_prompt)
            self.assertEqual(call_args["whatsapp_access_token"], self.store_a.whatsapp_access_token)

            # 2. Payload targeting Store B
            mock_add_task.reset_mock()
            payload_b = {
                "object": "whatsapp_business_account",
                "entry": [
                    {
                        "id": "WABA_ID",
                        "changes": [
                            {
                                "value": {
                                    "messaging_product": "whatsapp",
                                    "metadata": {
                                        "display_phone_number": "15550002",
                                        "phone_number_id": self.phone_id_b,
                                    },
                                    "messages": [
                                        {
                                            "from": "923002222222",
                                            "id": "wamid.msg_beta_01",
                                            "text": {"body": "Hi Beta store!"},
                                            "type": "text",
                                        }
                                    ],
                                },
                                "field": "messages",
                            }
                        ],
                    }
                ],
            }

            resp_b = self.client.post("/api/v1/webhooks/whatsapp", json=payload_b)
            self.assertEqual(resp_b.status_code, 200)
            self.assertEqual(resp_b.json(), {"status": "EVENT_RECEIVED"})

            # Verify background task scheduled with Store B's store_id
            self.assertTrue(mock_add_task.called)
            call_args_b = mock_add_task.call_args[1]
            self.assertEqual(call_args_b["sender_phone"], "923002222222")
            self.assertEqual(call_args_b["store_id"], self.store_b.id)
            self.assertEqual(call_args_b["system_prompt"], self.store_b.system_prompt)
            self.assertEqual(call_args_b["whatsapp_access_token"], self.store_b.whatsapp_access_token)

    def test_webhook_unmatched_or_inactive_phone_number_id_returns_200_and_logs(self):
        """Verify webhook returns 200 OK and skips task scheduling when phone_number_id is unknown or inactive."""
        with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
            # 1. Unknown phone number ID
            unknown_payload = {
                "object": "whatsapp_business_account",
                "entry": [
                    {
                        "id": "WABA_ID",
                        "changes": [
                            {
                                "value": {
                                    "messaging_product": "whatsapp",
                                    "metadata": {
                                        "phone_number_id": "999999999999_unknown",
                                    },
                                    "messages": [
                                        {
                                            "from": "923009999999",
                                            "id": "wamid.msg_unknown",
                                            "text": {"body": "Hello?"},
                                            "type": "text",
                                        }
                                    ],
                                },
                                "field": "messages",
                            }
                        ],
                    }
                ],
            }

            resp = self.client.post("/api/v1/webhooks/whatsapp", json=unknown_payload)
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json(), {"status": "EVENT_RECEIVED"})
            # Should NOT schedule background task
            self.assertFalse(mock_add_task.called)

            # 2. Inactive store phone number ID
            inactive_payload = {
                "object": "whatsapp_business_account",
                "entry": [
                    {
                        "id": "WABA_ID",
                        "changes": [
                            {
                                "value": {
                                    "messaging_product": "whatsapp",
                                    "metadata": {
                                        "phone_number_id": self.phone_id_inactive,
                                    },
                                    "messages": [
                                        {
                                            "from": "923009999999",
                                            "id": "wamid.msg_inactive",
                                            "text": {"body": "Hello inactive?"},
                                            "type": "text",
                                        }
                                    ],
                                },
                                "field": "messages",
                            }
                        ],
                    }
                ],
            }

            resp_inact = self.client.post("/api/v1/webhooks/whatsapp", json=inactive_payload)
            self.assertEqual(resp_inact.status_code, 200)
            self.assertFalse(mock_add_task.called)

    def test_order_tracking_tenant_isolation_no_data_leakage(self):
        """Verify that track_order filters strictly by store_id and prevents cross-tenant data leaks."""
        order_num = f"ORD-MT-{self.unique_suffix}"

        # Create order for Store A
        order_a = Order(
            store_id=self.store_a.id,
            order_number=order_num,
            customer_name="Alpha Customer",
            customer_email="alpha.cust@example.com",
            status="Shipped",
            carrier="Alpha Express",
            tracking_number="TRK-ALPHA-01",
            items=[{"name": "Silk Dress", "quantity": 1, "price": 250.0}],
            total_amount=250.0,
        )

        # Create order with same or different number for Store B
        order_b = Order(
            store_id=self.store_b.id,
            order_number=f"{order_num}-B",
            customer_name="Beta Customer",
            customer_email="beta.cust@example.com",
            status="Processing",
            carrier="Beta Logistics",
            tracking_number="TRK-BETA-02",
            items=[{"name": "Smart Watch", "quantity": 1, "price": 199.0}],
            total_amount=199.0,
        )

        self.db.add_all([order_a, order_b])
        self.db.commit()

        # 1. Query Store A's order with Store A's store_id -> Succeeded
        res_a = track_order(order_num, store_id=self.store_a.id, db=self.db)
        self.assertEqual(res_a.get("order_number"), order_num)
        self.assertEqual(res_a.get("courier"), "Alpha Express")
        self.assertEqual(res_a.get("status"), "Shipped")

        # 2. Query Store A's order with Store B's store_id -> Blocked (Not found)
        res_leak_attempt = track_order(order_num, store_id=self.store_b.id, db=self.db)
        self.assertEqual(res_leak_attempt, {"error": "Order not found"})

        # 3. Query Store B's order with Store B's store_id -> Succeeded
        res_b = track_order(f"{order_num}-B", store_id=self.store_b.id, db=self.db)
        self.assertEqual(res_b.get("order_number"), f"{order_num}-B")
        self.assertEqual(res_b.get("courier"), "Beta Logistics")

        # 4. Query Store B's order with Store A's store_id -> Blocked (Not found)
        res_leak_attempt_b = track_order(f"{order_num}-B", store_id=self.store_a.id, db=self.db)
        self.assertEqual(res_leak_attempt_b, {"error": "Order not found"})

    def test_product_stock_tenant_isolation_no_data_leakage(self):
        """Verify check_product_stock scopes catalog queries to the requested store_id only."""
        prod_title_a = f"Alpha Silk Robe {self.unique_suffix}"
        prod_title_b = f"Beta Drone Pro {self.unique_suffix}"

        prod_a = Product(
            store_id=self.store_a.id,
            sku=f"SKU-A-{self.unique_suffix}",
            title=prod_title_a,
            category="Luxury Fashion",
            price=150.0,
            stock_quantity=12,
        )

        prod_b = Product(
            store_id=self.store_b.id,
            sku=f"SKU-B-{self.unique_suffix}",
            title=prod_title_b,
            category="Electronics",
            price=499.0,
            stock_quantity=5,
        )

        self.db.add_all([prod_a, prod_b])
        self.db.commit()

        # 1. Store A queries its own product -> Succeeded
        res_a = check_product_stock(prod_title_a, store_id=self.store_a.id, db=self.db)
        self.assertEqual(res_a.get("name"), prod_title_a)
        self.assertEqual(res_a.get("stock_quantity"), 12)
        self.assertTrue(res_a.get("in_stock"))

        # 2. Store B queries Store A's product -> Product not found (No catalog leak)
        res_leak_a = check_product_stock(prod_title_a, store_id=self.store_b.id, db=self.db)
        self.assertEqual(res_leak_a, {"error": "Product not found"})

        # 3. Store B queries its own product -> Succeeded
        res_b = check_product_stock(prod_title_b, store_id=self.store_b.id, db=self.db)
        self.assertEqual(res_b.get("name"), prod_title_b)
        self.assertEqual(res_b.get("stock_quantity"), 5)

        # 4. Store A queries Store B's product -> Product not found
        res_leak_b = check_product_stock(prod_title_b, store_id=self.store_a.id, db=self.db)
        self.assertEqual(res_leak_b, {"error": "Product not found"})

    def test_chat_memory_partitioning_by_store_and_phone(self):
        """Verify that the same customer phone interacting with different stores keeps isolated conversation contexts."""
        customer_phone = "923187806999"
        session_a = ChatService.build_session_id(customer_phone, store_id=self.store_a.id)
        session_b = ChatService.build_session_id(customer_phone, store_id=self.store_b.id)

        self.assertNotEqual(session_a, session_b)
        self.assertIn(str(self.store_a.id), session_a)
        self.assertIn(str(self.store_b.id), session_b)

        chat_service = ChatService(self.db)

        # Record messages in Store A
        chat_service.add_message(session_id=session_a, role="user", content="Looking for silk dresses", store_id=self.store_a.id)
        chat_service.add_message(session_id=session_a, role="assistant", content="We have premium silk dresses available!", store_id=self.store_a.id)

        # Record messages in Store B
        chat_service.add_message(session_id=session_b, role="user", content="Looking for wireless headphones", store_id=self.store_b.id)
        chat_service.add_message(session_id=session_b, role="assistant", content="We have noise-canceling headphones!", store_id=self.store_b.id)

        # Fetch history for Store A
        hist_a = chat_service.get_gemini_history(session_id=session_a, store_id=self.store_a.id)
        self.assertEqual(len(hist_a), 2)
        self.assertIn("silk dresses", hist_a[0]["parts"][0]["text"].lower())

        # Fetch history for Store B
        hist_b = chat_service.get_gemini_history(session_id=session_b, store_id=self.store_b.id)
        self.assertEqual(len(hist_b), 2)
        self.assertIn("headphones", hist_b[0]["parts"][0]["text"].lower())

        # Verify no cross-contamination
        texts_a = [turn["parts"][0]["text"] for turn in hist_a]
        self.assertFalse(any("headphones" in t.lower() for t in texts_a))

        texts_b = [turn["parts"][0]["text"] for turn in hist_b]
        self.assertFalse(any("silk" in t.lower() for t in texts_b))

    def test_inbound_worker_uses_tenant_custom_prompt_and_credentials(self):
        """Verify handle_inbound_whatsapp_message uses tenant custom instructions and access token."""
        sender_phone = "923005555555"
        test_msg = "What kind of store are you?"

        with patch("app.services.ai_support_service.ai_support_service.generate_support_reply") as mock_ai, \
             patch("app.services.whatsapp_service.whatsapp_service.send_text_message") as mock_send:

            mock_ai.return_value = "We are Store Alpha, a luxury fashion brand."
            mock_send.return_value = {"success": True, "mock": True}

            asyncio.run(
                handle_inbound_whatsapp_message(
                    sender_phone=sender_phone,
                    message_text=test_msg,
                    message_id="wamid.test_tenant_msg",
                    store_id=self.store_a.id,
                    system_prompt=self.store_a.system_prompt,
                    whatsapp_access_token=self.store_a.whatsapp_access_token,
                    phone_number_id=self.store_a.whatsapp_phone_number_id,
                )
            )

            # Verify generate_support_reply was called with tenant instructions & store_id
            self.assertTrue(mock_ai.called)
            ai_call_kwargs = mock_ai.call_args[1]
            self.assertEqual(ai_call_kwargs["customer_message"], test_msg)
            self.assertEqual(ai_call_kwargs["store_id"], self.store_a.id)
            self.assertEqual(ai_call_kwargs["system_instruction"], self.store_a.system_prompt)

            # Verify send_text_message was called with tenant's access token and phone_number_id
            self.assertTrue(mock_send.called)
            send_kwargs = mock_send.call_args[1]
            self.assertEqual(send_kwargs["to_phone_number"], sender_phone)
            self.assertEqual(send_kwargs["token"], self.store_a.whatsapp_access_token)
            self.assertEqual(send_kwargs["phone_number_id"], self.store_a.whatsapp_phone_number_id)

            # Verify messages were stored with store_id in ChatHistory
            expected_session = ChatService.build_session_id(sender_phone, store_id=self.store_a.id)
            chats = self.db.query(ChatHistory).filter(ChatHistory.session_id == expected_session).all()
            self.assertEqual(len(chats), 2)
            self.assertEqual(chats[0].store_id, self.store_a.id)
            self.assertEqual(chats[1].store_id, self.store_a.id)


if __name__ == "__main__":
    unittest.main()
