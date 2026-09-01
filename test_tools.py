import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from tools import get_order_status, check_product_inventory, apply_cart_recovery_discount, execute_tool, OPENAI_TOOLS


def test_order_status():
    print("Testing get_order_status...")
    # Test valid order 1042
    res = get_order_status("1042")
    assert res["success"] is True, "Order 1042 lookup failed"
    assert res["status"] == "Shipped", f"Expected Shipped, got {res['status']}"
    assert res["tracking_number"] == "TRK-FEDEX-984210"
    assert "https://tracking.carrier.com" in res["tracking_url"]
    print("  ✓ Order #1042 (Shipped) lookup successful")

    # Test order with '#' symbol
    res_hash = get_order_status("#1043")
    assert res_hash["success"] is True, "Order #1043 lookup failed"
    assert res_hash["status"] == "Processing"
    print("  ✓ Order #1043 (Processing with #) lookup successful")

    # Test non-existent order
    res_invalid = get_order_status("99999")
    assert res_invalid["success"] is False
    assert "not found" in res_invalid["error"].lower()
    print("  ✓ Non-existent order handled cleanly")


def test_product_inventory():
    print("\nTesting check_product_inventory...")
    # Test existing product with out-of-stock size L
    res_l = check_product_inventory("Classic White T-Shirt", size="L")
    assert len(res_l) > 0
    item = res_l[0]
    assert item["in_stock"] is False, "Size L should be out of stock"
    assert item["stock_count"] == 0
    assert len(item["alternative_available_sizes"]) > 0, "Should provide alternative sizes"
    alt_sizes = [a["size"] for a in item["alternative_available_sizes"]]
    assert "S" in alt_sizes and "M" in alt_sizes and "XL" in alt_sizes
    print("  ✓ Size L out-of-stock detection & alternative suggestions verified")

    # Test in-stock size M
    res_m = check_product_inventory("Classic White T-Shirt", size="M")
    assert res_m[0]["in_stock"] is True
    assert res_m[0]["stock_count"] == 8
    print("  ✓ Size M in-stock check verified")

    # Test general product search without size
    res_all = check_product_inventory("Headphones")
    assert len(res_all) > 0
    assert res_all[0]["product_name"] == "Wireless Noise-Canceling Headphones"
    assert res_all[0]["in_stock"] is True
    print("  ✓ General product search verified")


def test_cart_recovery():
    print("\nTesting apply_cart_recovery_discount...")
    # Eligible customer
    res_eligible = apply_cart_recovery_discount("sarah.smith@example.com")
    assert res_eligible["success"] is True
    assert res_eligible["discount_code"] == "SAVE15"
    assert res_eligible["discount_percentage"] == 15
    print("  ✓ Eligible cart recovery verified")

    # Non-eligible customer
    res_ineligible = apply_cart_recovery_discount("john.doe@example.com")
    assert res_ineligible["success"] is False
    assert "already redeemed" in res_ineligible["reason"].lower()
    print("  ✓ Ineligible cart recovery handled")

    # Unknown customer
    res_unknown = apply_cart_recovery_discount("random@example.com")
    assert res_unknown["success"] is False
    assert "no active or abandoned cart session" in res_unknown["error"].lower()
    print("  ✓ Unknown customer cart recovery handled")


def test_tool_schemas_and_dispatcher():
    print("\nTesting OpenAI Tool Schemas and Dispatcher...")
    assert len(OPENAI_TOOLS) == 3, "Expected 3 tool definitions"
    for tool in OPENAI_TOOLS:
        assert tool["type"] == "function"
        assert "name" in tool["function"]
        assert "description" in tool["function"]
        assert "parameters" in tool["function"]
    
    # Test dispatcher
    dispatched = execute_tool("get_order_status", {"order_id": "1042"})
    assert dispatched["success"] is True
    print("  ✓ Tool dispatcher and schemas verified")


if __name__ == "__main__":
    test_order_status()
    test_product_inventory()
    test_cart_recovery()
    test_tool_schemas_and_dispatcher()
    print("\n🎉 ALL UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!")
