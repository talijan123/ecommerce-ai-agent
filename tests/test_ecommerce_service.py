"""
Unit Tests for EcommerceService (Shopify / Custom Store Live Integration and Security Validation).
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ecommerce_service import EcommerceService, ecommerce_service
from tools import get_order_status, check_product_inventory, execute_tool, OPENAI_TOOLS


class TestEcommerceService(unittest.TestCase):
    def setUp(self):
        self.service = EcommerceService()

    def test_phone_normalization_and_matching(self):
        """Test phone number normalization and international format matching."""
        self.assertEqual(EcommerceService.normalize_phone("+92 318-7806306"), "923187806306")
        self.assertEqual(EcommerceService.normalize_phone("0318-7806306"), "03187806306")

        # Matching variations of Pakistan numbers (+92 vs 03 vs 92)
        self.assertTrue(EcommerceService.phones_match("+923187806306", "03187806306"))
        self.assertTrue(EcommerceService.phones_match("923187806306", "+923187806306"))
        self.assertTrue(EcommerceService.phones_match("14155552671", "+1 (415) 555-2671"))

        # Mismatched numbers
        self.assertFalse(EcommerceService.phones_match("+923187806306", "+14155552671"))
        self.assertFalse(EcommerceService.phones_match("923187806306", "923001234567"))
        self.assertFalse(EcommerceService.phones_match("", "+923187806306"))

    def test_get_order_by_number_matching_phone(self):
        """Test order lookup with matching registered phone succeeds."""
        res = self.service.get_order_by_number("1042", phone="+923187806306")
        self.assertTrue(res["success"])
        self.assertEqual(res["order_id"], "1042")
        self.assertEqual(res["status"], "Shipped")
        self.assertEqual(res["carrier"], "FedEx Express")
        self.assertEqual(res["tracking_number"], "TRK-FEDEX-984210")
        self.assertIn("https://tracking.carrier.com", res["tracking_url"])
        self.assertEqual(len(res["items"]), 2)

    def test_get_order_by_number_security_mismatch(self):
        """Test order lookup with mismatched phone returns security privacy error."""
        res = self.service.get_order_by_number("1042", phone="+14155559999")
        self.assertFalse(res["success"])
        self.assertTrue(res.get("security_error"))
        self.assertIn("security and privacy reasons", res["error"].lower())

    def test_get_order_by_number_without_phone(self):
        """Test order lookup without phone number retrieves order details cleanly."""
        res = self.service.get_order_by_number("#1043")
        self.assertTrue(res["success"])
        self.assertEqual(res["order_id"], "1043")
        self.assertEqual(res["status"], "Processing")
        self.assertEqual(res["customer_name"], "Ali Khan")

    def test_get_order_by_number_not_found(self):
        """Test lookup for non-existent order number."""
        res = self.service.get_order_by_number("999999")
        self.assertFalse(res["success"])
        self.assertIn("not found", res["error"].lower())

    def test_get_product_stock_in_stock(self):
        """Test product search for in-stock variant."""
        res = self.service.get_product_stock("Classic White T-Shirt", size="M")
        self.assertTrue(len(res) > 0)
        item = res[0]
        self.assertTrue(item["in_stock"])
        self.assertEqual(item["stock_count"], 8)
        self.assertEqual(item["requested_size"], "M")

    def test_get_product_stock_out_of_stock_with_alternatives(self):
        """Test product search for out-of-stock variant returns alternative available sizes."""
        res = self.service.get_product_stock("Classic White T-Shirt", size="L")
        self.assertTrue(len(res) > 0)
        item = res[0]
        self.assertFalse(item["in_stock"])
        self.assertEqual(item["stock_count"], 0)
        self.assertTrue(len(item["alternative_available_sizes"]) > 0)
        alt_sizes = [a["size"] for a in item["alternative_available_sizes"]]
        self.assertIn("S", alt_sizes)
        self.assertIn("M", alt_sizes)
        self.assertIn("XL", alt_sizes)

    @patch("requests.get")
    def test_shopify_live_api_order_success(self, mock_get):
        """Test live Shopify API order retrieval when configured."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "orders": [
                {
                    "order_number": 5510,
                    "created_at": "2026-09-01T10:00:00Z",
                    "total_price": "129.99",
                    "phone": "+923187806306",
                    "customer": {"first_name": "Talal", "last_name": "Shopper", "phone": "+923187806306"},
                    "shipping_address": {"address1": "Main Blvd", "city": "Lahore", "country": "Pakistan", "phone": "+923187806306"},
                    "fulfillments": [
                        {
                            "shipment_status": "in_transit",
                            "tracking_company": "TCS Express",
                            "tracking_number": "TCS-991283",
                            "tracking_url": "https://tcs.com/track/TCS-991283",
                        }
                    ],
                    "line_items": [
                        {"name": "Embroidered Kurta", "quantity": 1, "price": "129.99", "variant_title": "Large"}
                    ]
                }
            ]
        }
        mock_get.return_value = mock_response

        live_service = EcommerceService(
            shopify_store_url="test-store.myshopify.com",
            shopify_access_token="shpat_test_token_abc123",
        )

        res = live_service.get_order_by_number("5510", phone="+923187806306")
        self.assertTrue(res["success"])
        self.assertEqual(res["order_id"], "5510")
        self.assertEqual(res["customer_name"], "Talal Shopper")
        self.assertEqual(res["carrier"], "TCS Express")
        self.assertEqual(res["tracking_number"], "TCS-991283")
        self.assertEqual(res["source"], "Shopify API")

    @patch("requests.get")
    def test_shopify_live_api_security_mismatch(self, mock_get):
        """Test Shopify live order returns security error if caller phone does not match order phone."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "orders": [
                {
                    "order_number": 5510,
                    "phone": "+923187806306",
                    "customer": {"phone": "+923187806306"},
                    "shipping_address": {"phone": "+923187806306"},
                }
            ]
        }
        mock_get.return_value = mock_response

        live_service = EcommerceService(
            shopify_store_url="test-store.myshopify.com",
            shopify_access_token="shpat_test_token_abc123",
        )

        # Mismatched phone caller
        res = live_service.get_order_by_number("5510", phone="+14155559999")
        self.assertFalse(res["success"])
        self.assertTrue(res.get("security_error"))

    def test_tools_module_integration(self):
        """Test tools.py function dispatching to ecommerce_service."""
        # Test get_order_status
        order_res = get_order_status("1042", phone="+923187806306")
        self.assertTrue(order_res["success"])
        self.assertEqual(order_res["carrier"], "FedEx Express")

        # Test execute_tool dispatcher
        dispatched_order = execute_tool("get_order_status", {"order_id": "1042", "phone": "+923187806306"})
        self.assertTrue(dispatched_order["success"])

        # Test check_product_inventory via tool dispatcher
        dispatched_inv = execute_tool("check_product_inventory", {"product_name": "Headphones"})
        self.assertTrue(len(dispatched_inv) > 0)
        self.assertEqual(dispatched_inv[0]["product_name"], "Wireless Noise-Canceling Headphones")

        # Test tool schema includes phone parameter
        order_tool_schema = next(t for t in OPENAI_TOOLS if t["function"]["name"] == "get_order_status")
        self.assertIn("phone", order_tool_schema["function"]["parameters"]["properties"])


if __name__ == "__main__":
    unittest.main()
