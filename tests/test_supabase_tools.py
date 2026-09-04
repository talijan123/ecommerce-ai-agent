"""
Unit Tests for Supabase Client Tools (track_order & check_product_stock)
and Gemini AI Function Calling Execution Loop.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.supabase_service import (
    track_order,
    check_product_stock,
    execute_supabase_tool,
    get_supabase_client,
)
from app.services.ai_support_service import AISupportService, ai_support_service


class TestSupabaseTools(unittest.TestCase):
    def setUp(self):
        # Create a mock Supabase Client
        self.mock_client = MagicMock()

    def test_track_order_success(self):
        """Test track_order returns order dictionary when order exists in Supabase."""
        mock_order = {
            "id": 1042,
            "status": "Shipped",
            "tracking_number": "TRK-FEDEX-984210",
            "courier": "FedEx Express",
            "created_at": "2026-09-01T10:00:00Z",
            "items": [{"name": "Minimalist Ceramic Lamp", "quantity": 1, "price": 85.0}],
        }
        
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_res = MagicMock()
        mock_res.data = [mock_order]

        self.mock_client.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.execute.return_value = mock_res

        result = track_order(order_id="1042", client=self.mock_client)

        self.assertEqual(result["id"], 1042)
        self.assertEqual(result["status"], "Shipped")
        self.assertEqual(result["tracking_number"], "TRK-FEDEX-984210")
        self.assertEqual(result["courier"], "FedEx Express")
        self.assertEqual(len(result["items"]), 1)

        # Verify query chain
        self.mock_client.table.assert_called_with("orders")
        mock_table.select.assert_called_with("id, status, tracking_number, courier, created_at, items")
        mock_select.eq.assert_called_with("id", "1042")

    def test_track_order_not_found(self):
        """Test track_order returns clear error message when order is not found."""
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_eq = MagicMock()
        mock_res = MagicMock()
        mock_res.data = []

        self.mock_client.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.eq.return_value = mock_eq
        mock_eq.execute.return_value = mock_res

        result = track_order(order_id="9999", client=self.mock_client)

        self.assertIn("error", result)
        self.assertEqual(result["error"], "Order not found")

    def test_track_order_empty_input(self):
        """Test track_order handles empty or whitespace input safely."""
        result = track_order(order_id="", client=self.mock_client)
        self.assertEqual(result, {"error": "Order not found"})

        result_space = track_order(order_id="   ", client=self.mock_client)
        self.assertEqual(result_space, {"error": "Order not found"})

    def test_track_order_exception_handling(self):
        """Test track_order handles database connection errors gracefully without crashing."""
        mock_table = MagicMock()
        mock_table.select.side_effect = Exception("Supabase connection timeout")
        self.mock_client.table.return_value = mock_table

        result = track_order(order_id="1042", client=self.mock_client)
        self.assertIn("error", result)
        self.assertEqual(result["error"], "Order not found")

    def test_check_product_stock_success_single(self):
        """Test check_product_stock returns matched product info."""
        mock_product = {
            "name": "Minimalist Ceramic Lamp",
            "stock_quantity": 25,
            "price": 85.0,
            "in_stock": True,
        }

        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_ilike = MagicMock()
        mock_res = MagicMock()
        mock_res.data = [mock_product]

        self.mock_client.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.ilike.return_value = mock_ilike
        mock_ilike.execute.return_value = mock_res

        result = check_product_stock(product_name="Ceramic Lamp", client=self.mock_client)

        self.assertEqual(result["name"], "Minimalist Ceramic Lamp")
        self.assertEqual(result["stock_quantity"], 25)
        self.assertEqual(result["price"], 85.0)
        self.assertTrue(result["in_stock"])

        # Verify query chain
        self.mock_client.table.assert_called_with("products")
        mock_table.select.assert_called_with("name, stock_quantity, price, in_stock")
        mock_select.ilike.assert_called_with("name", "%Ceramic Lamp%")

    def test_check_product_stock_success_multiple(self):
        """Test check_product_stock returns grouped list when multiple products match."""
        mock_products = [
            {"name": "Wireless Headphones Pro", "stock_quantity": 10, "price": 120.0, "in_stock": True},
            {"name": "Wireless Earbuds Lite", "stock_quantity": 4, "price": 45.0, "in_stock": True},
        ]

        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_ilike = MagicMock()
        mock_res = MagicMock()
        mock_res.data = mock_products

        self.mock_client.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.ilike.return_value = mock_ilike
        mock_ilike.execute.return_value = mock_res

        result = check_product_stock(product_name="Wireless", client=self.mock_client)

        self.assertIn("products", result)
        self.assertEqual(result["count"], 2)
        self.assertEqual(len(result["products"]), 2)

    def test_check_product_stock_not_found(self):
        """Test check_product_stock returns clear error message when product is not found."""
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_ilike = MagicMock()
        mock_res = MagicMock()
        mock_res.data = []

        self.mock_client.table.return_value = mock_table
        mock_table.select.return_value = mock_select
        mock_select.ilike.return_value = mock_ilike
        mock_ilike.execute.return_value = mock_res

        result = check_product_stock(product_name="NonExistentItem999", client=self.mock_client)

        self.assertIn("error", result)
        self.assertEqual(result["error"], "Product not found")

    def test_check_product_stock_exception_handling(self):
        """Test check_product_stock catches errors gracefully."""
        mock_table = MagicMock()
        mock_table.select.side_effect = Exception("Supabase DB disconnect")
        self.mock_client.table.return_value = mock_table

        result = check_product_stock(product_name="Lamp", client=self.mock_client)
        self.assertIn("error", result)
        self.assertEqual(result["error"], "Product not found")

    def test_execute_supabase_tool_dispatcher(self):
        """Test tool execution dispatcher routes correctly."""
        with patch("app.services.supabase_service.track_order") as mock_track:
            mock_track.return_value = {"id": "1042", "status": "Shipped"}
            res = execute_supabase_tool("track_order", {"order_id": "1042"})
            self.assertEqual(res["status"], "Shipped")

        with patch("app.services.supabase_service.check_product_stock") as mock_stock:
            mock_stock.return_value = {"name": "Lamp", "in_stock": True}
            res = execute_supabase_tool("check_product_stock", {"product_name": "Lamp"})
            self.assertTrue(res["in_stock"])

        unreg = execute_supabase_tool("unregistered_tool_name", {})
        self.assertIn("error", unreg)


class TestGeminiFunctionCallingLoop(unittest.TestCase):
    def setUp(self):
        self.service = AISupportService()

    @patch("requests.post")
    @patch("app.services.ai_support_service.execute_supabase_tool")
    def test_gemini_function_calling_order_tracking(self, mock_execute_tool, mock_requests_post):
        """
        Test Gemini multi-turn function calling execution loop:
        1. Gemini emits functionCall for track_order.
        2. Tool executes against Supabase tool layer.
        3. Function result is returned to Gemini.
        4. Gemini synthesizes final conversational reply.
        """
        # Turn 1 response: Gemini requests track_order
        resp_turn1 = MagicMock()
        resp_turn1.status_code = 200
        resp_turn1.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [
                            {
                                "functionCall": {
                                    "name": "track_order",
                                    "args": {"order_id": "1042"}
                                }
                            }
                        ]
                    }
                }
            ]
        }

        # Turn 2 response: Gemini returns final text response
        resp_turn2 = MagicMock()
        resp_turn2.status_code = 200
        resp_turn2.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [
                            {
                                "text": "Your order #1042 has Shipped with FedEx Express (Tracking: TRK-FEDEX-984210) 📦 and will arrive in 2-4 business days!"
                            }
                        ]
                    }
                }
            ]
        }

        mock_requests_post.side_effect = [resp_turn1, resp_turn2]
        mock_execute_tool.return_value = {
            "id": "1042",
            "status": "Shipped",
            "tracking_number": "TRK-FEDEX-984210",
            "courier": "FedEx Express",
            "created_at": "2026-09-01T10:00:00Z",
            "items": [{"name": "Minimalist Ceramic Lamp", "quantity": 1}],
        }

        reply = self.service._call_gemini_api(
            prompt="Where is my order #1042?",
            api_key="AIzaSyDummyKeyForTesting",
            model="gemini-2.5-flash",
        )

        # Verify tool was called
        mock_execute_tool.assert_called_once_with("track_order", {"order_id": "1042"})

        # Verify 2 turns occurred
        self.assertEqual(mock_requests_post.call_count, 2)

        # Verify final reply
        self.assertIsNotNone(reply)
        self.assertIn("1042", reply)
        self.assertIn("Shipped", reply)
        self.assertIn("FedEx", reply)

    @patch("requests.post")
    @patch("app.services.ai_support_service.execute_supabase_tool")
    def test_gemini_function_calling_product_stock(self, mock_execute_tool, mock_requests_post):
        """
        Test Gemini multi-turn function calling execution loop for check_product_stock.
        """
        # Turn 1: Gemini requests check_product_stock
        resp_turn1 = MagicMock()
        resp_turn1.status_code = 200
        resp_turn1.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [
                            {
                                "functionCall": {
                                    "name": "check_product_stock",
                                    "args": {"product_name": "Minimalist Ceramic Lamp"}
                                }
                            }
                        ]
                    }
                }
            ]
        }

        # Turn 2: Gemini returns final conversational answer
        resp_turn2 = MagicMock()
        resp_turn2.status_code = 200
        resp_turn2.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "role": "model",
                        "parts": [
                            {
                                "text": "Yes! The Minimalist Ceramic Lamp is currently in stock (25 units available) for $85.00 ✨."
                            }
                        ]
                    }
                }
            ]
        }

        mock_requests_post.side_effect = [resp_turn1, resp_turn2]
        mock_execute_tool.return_value = {
            "name": "Minimalist Ceramic Lamp",
            "stock_quantity": 25,
            "price": 85.0,
            "in_stock": True,
        }

        reply = self.service._call_gemini_api(
            prompt="Is the Minimalist Ceramic Lamp available?",
            api_key="AIzaSyDummyKeyForTesting",
            model="gemini-2.5-flash",
        )

        mock_execute_tool.assert_called_once_with("check_product_stock", {"product_name": "Minimalist Ceramic Lamp"})
        self.assertEqual(mock_requests_post.call_count, 2)
        self.assertIn("Minimalist Ceramic Lamp", reply)
        self.assertIn("in stock", reply.lower())


if __name__ == "__main__":
    unittest.main()
