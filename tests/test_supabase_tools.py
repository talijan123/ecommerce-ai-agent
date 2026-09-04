"""
Unit Tests for Database Tools (track_order & check_product_stock)
and Gemini AI Function Calling Execution Loop.
"""

import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.db_tools import (
    track_order,
    check_product_stock,
    execute_db_tool,
    execute_supabase_tool,
)
from app.services.ai_support_service import AISupportService, ai_support_service
from app.models.order import Order
from app.models.product import Product


class TestDatabaseTools(unittest.TestCase):
    def setUp(self):
        # Create a mock SQLAlchemy Session
        self.mock_db = MagicMock()

    def test_track_order_success(self):
        """Test track_order returns order dictionary when order exists in DB."""
        mock_order = MagicMock()
        mock_order.id = 1042
        mock_order.order_number = "1042"
        mock_order.status = "Shipped"
        mock_order.tracking_number = "TRK-FEDEX-984210"
        mock_order.carrier = "FedEx Express"
        mock_order.courier = "FedEx Express"
        mock_order.created_at = MagicMock()
        mock_order.created_at.isoformat.return_value = "2026-09-01T10:00:00Z"
        mock_order.items = [{"name": "Minimalist Ceramic Lamp", "quantity": 1, "price": 85.0}]

        mock_query = MagicMock()
        mock_filter = MagicMock()
        self.mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = mock_order

        result = track_order(order_id="1042", db=self.mock_db)

        self.assertEqual(result["id"], 1042)
        self.assertEqual(result["order_number"], "1042")
        self.assertEqual(result["status"], "Shipped")
        self.assertEqual(result["tracking_number"], "TRK-FEDEX-984210")
        self.assertEqual(result["courier"], "FedEx Express")
        self.assertEqual(len(result["items"]), 1)

    def test_track_order_not_found(self):
        """Test track_order returns clear error message when order is not found."""
        mock_query = MagicMock()
        mock_filter = MagicMock()
        self.mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.first.return_value = None

        result = track_order(order_id="9999", db=self.mock_db)

        self.assertIn("error", result)
        self.assertEqual(result["error"], "Order not found")

    def test_track_order_empty_input(self):
        """Test track_order handles empty or whitespace input safely."""
        result = track_order(order_id="", db=self.mock_db)
        self.assertEqual(result, {"error": "Order not found"})

        result_space = track_order(order_id="   ", db=self.mock_db)
        self.assertEqual(result_space, {"error": "Order not found"})

    def test_track_order_exception_handling(self):
        """Test track_order handles database connection errors gracefully without crashing."""
        self.mock_db.query.side_effect = Exception("PostgreSQL connection timeout")

        result = track_order(order_id="1042", db=self.mock_db)
        self.assertIn("error", result)
        self.assertEqual(result["error"], "Order not found")

    def test_check_product_stock_success_single(self):
        """Test check_product_stock returns matched product info."""
        mock_product = MagicMock()
        mock_product.id = 1
        mock_product.title = "Minimalist Ceramic Lamp"
        mock_product.stock_quantity = 25
        mock_product.price = 85.0
        mock_product.category = "Home Decor"

        mock_query = MagicMock()
        mock_filter = MagicMock()
        self.mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [mock_product]

        result = check_product_stock(product_name="Ceramic Lamp", db=self.mock_db)

        self.assertEqual(result["name"], "Minimalist Ceramic Lamp")
        self.assertEqual(result["stock_quantity"], 25)
        self.assertEqual(result["price"], 85.0)
        self.assertTrue(result["in_stock"])

    def test_check_product_stock_success_multiple(self):
        """Test check_product_stock returns grouped list when multiple products match."""
        p1 = MagicMock()
        p1.id = 1
        p1.title = "Wireless Headphones Pro"
        p1.stock_quantity = 10
        p1.price = 120.0
        p1.category = "Electronics"

        p2 = MagicMock()
        p2.id = 2
        p2.title = "Wireless Earbuds Lite"
        p2.stock_quantity = 4
        p2.price = 45.0
        p2.category = "Electronics"

        mock_query = MagicMock()
        mock_filter = MagicMock()
        self.mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = [p1, p2]

        result = check_product_stock(product_name="Wireless", db=self.mock_db)

        self.assertIn("products", result)
        self.assertEqual(result["count"], 2)
        self.assertEqual(len(result["products"]), 2)

    def test_check_product_stock_not_found(self):
        """Test check_product_stock returns clear error message when product is not found."""
        mock_query = MagicMock()
        mock_filter = MagicMock()
        self.mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_filter
        mock_filter.all.return_value = []

        result = check_product_stock(product_name="NonExistentItem999", db=self.mock_db)

        self.assertIn("error", result)
        self.assertEqual(result["error"], "Product not found")

    def test_check_product_stock_exception_handling(self):
        """Test check_product_stock catches errors gracefully."""
        self.mock_db.query.side_effect = Exception("DB connection dropped")

        result = check_product_stock(product_name="Lamp", db=self.mock_db)
        self.assertIn("error", result)
        self.assertEqual(result["error"], "Product not found")

    def test_execute_supabase_tool_dispatcher(self):
        """Test tool execution dispatcher routes correctly."""
        with patch("app.services.db_tools.track_order") as mock_track:
            mock_track.return_value = {"id": 1042, "status": "Shipped"}
            res = execute_supabase_tool("track_order", {"order_id": "1042"})
            self.assertEqual(res["status"], "Shipped")

        with patch("app.services.db_tools.check_product_stock") as mock_stock:
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
        2. Tool executes against direct database tool layer.
        3. Function result is returned to Gemini.
        4. Gemini synthesizes final conversational reply.
        """
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
            "id": 1042,
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
