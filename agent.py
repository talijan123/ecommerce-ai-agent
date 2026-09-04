"""
Production-grade Proof of Concept (PoC) for an Autonomous E-Commerce AI Agent.
Powered by OpenAI Function Calling / Tool Calling and live data integration.

Features:
- Recursive multi-turn tool execution loop.
- Dynamic tool calling with strict schema definitions.
- Hallucination-free responses grounded in store database.
- Smart out-of-stock handling with alternative size/product recommendations.
- Multilingual query parsing (English, Roman Urdu, etc.).
- Interactive CLI + Automated Test Suite.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional

# Ensure UTF-8 output on Windows consoles
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv
import openai
from openai import OpenAI

from tools import OPENAI_TOOLS, execute_tool

# Load environment variables from .env file
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.1-70b-versatile")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# System Prompt defining agent personality, behavioral constraints, and multilingual capabilities
SYSTEM_PROMPT = """You are an expert, autonomous customer support AI assistant for an e-commerce store.

### CORE DIRECTIVES & BEHAVIORAL RULES:
1. **NO HALLUCINATIONS**: Never guess, assume, or fabricate order numbers, shipping details, tracking links, inventory stock levels, or discounts. You MUST ALWAYS call the appropriate tool first to retrieve verified real-time data before answering.
2. **INVENTORY & OUT-OF-STOCK HANDLING**:
   - If a customer asks for a product or size that is out of stock (stock_count = 0), explicitly state that the item is currently out of stock.
   - Proactively suggest any other available sizes that are in stock for that product, or suggest related products.
3. **MULTILINGUAL & ROMAN URDU SUPPORT**:
   - You natively understand and communicate in multiple languages, especially Roman Urdu (e.g., "Mera order 1043 kab deliver hoga?", "Kia ye shirt size M me available hai?").
   - When a user asks in Roman Urdu, respond politely and naturally in Roman Urdu (e.g., "Aapka order #1043 filhal processing me hai aur kal tak deliver ho jayega.").
   - Maintain a courteous, professional, and friendly tone in all languages.
4. **TOOL CALLING FORMAT**:
   - Always extract parameters accurately (e.g., clean order IDs like '1042' from '#1042' or 'order 1042').
   - Synthesize the tool output clearly, mentioning order status, tracking links, dates, and item names where relevant.
"""


def get_openai_client() -> Optional[OpenAI]:
    """Initialize and return OpenAI/Groq client if API key is present."""
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key or api_key.strip() == "" or "your_" in api_key:
        return None

    base_url = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
    return OpenAI(api_key=api_key, base_url=base_url)


def run_agent(
    user_query: str,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    max_turns: int = 5,
    verbose: bool = True,
    client: Optional[OpenAI] = None,
) -> str:
    """
    Execute the core recursive / multi-turn agent loop for a user query.

    Args:
        user_query: The customer's natural language input.
        chat_history: Optional prior conversation history.
        max_turns: Maximum tool-calling roundtrips to prevent infinite loops.
        verbose: If True, prints tool execution steps to console.
        client: Optional initialized OpenAI client.

    Returns:
        The final assistant response string.
    """
    if client is None:
        client = get_openai_client()

    if client is None:
        return (
            "⚠️ [CONFIGURATION NOTICE]: OPENAI_API_KEY is not set or invalid in `.env`.\n"
            "Please add your valid OpenAI API key in `.env` to run live queries:\n"
            "   OPENAI_API_KEY=sk-...\n"
        )

    # Initialize messages list
    messages: List[Dict[str, Any]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    if chat_history:
        messages.extend(chat_history)

    messages.append({"role": "user", "content": user_query})

    turn_count = 0
    model_name = os.getenv("LLM_MODEL") or (os.getenv("OPENAI_MODEL") if not os.getenv("GROQ_API_KEY") else "llama-3.1-70b-versatile")

    while turn_count < max_turns:
        turn_count += 1

        try:
            # Call Chat Completion with Tool Definitions
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=OPENAI_TOOLS,
                tool_choice="auto",
                temperature=0.2,
            )
        except Exception as e:
            error_msg = f"❌ OpenAI API Error: {str(e)}"
            if verbose:
                print(error_msg, file=sys.stderr)
            return error_msg

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        # If model decides to invoke one or more tools
        if tool_calls:
            # Append assistant's tool invocation message to conversation history
            messages.append(response_message)

            for tool_call in tool_calls:
                function_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    arguments = {}

                if verbose:
                    print(f"  🔧 [Tool Invoked]: {function_name}({json.dumps(arguments)})")

                # Execute Python function locally
                tool_output = execute_tool(function_name, arguments)

                if verbose:
                    print(f"  📦 [Tool Result]: {json.dumps(tool_output, indent=2)}")

                # Append tool result message with matching tool_call_id
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": json.dumps(tool_output),
                })

            # Continue loop so the model can process the tool outputs and formulate the final response
            continue

        # If no tool calls, model has produced the final answer
        final_content = response_message.content or ""
        return final_content

    return "⚠️ Maximum tool execution iterations reached without a final response."


def run_automated_tests(client: Optional[OpenAI] = None):
    """
    Run the 3 core verification test cases required by the specification.
    """
    print("\n" + "=" * 75)
    print(" 🚀 RUNNING AUTOMATED E-COMMERCE AGENT VERIFICATION TESTS")
    print("=" * 75)

    test_queries = [
        {
            "id": "TEST-1",
            "title": "Order Lookup Verification",
            "query": "Where is my order #1042?",
            "expected_behavior": "Should call get_order_status(order_id='1042') and report Shipped status with tracking info.",
        },
        {
            "id": "TEST-2",
            "title": "Out-of-Stock Handling & Alternatives",
            "query": "Do you have the Classic White T-Shirt in size L?",
            "expected_behavior": "Should call check_product_inventory, report size L is out of stock, and offer sizes S, M, XL.",
        },
        {
            "id": "TEST-3",
            "title": "Roman Urdu Multilingual Parsing",
            "query": "Mera order 1043 kab deliver hoga?",
            "expected_behavior": "Should call get_order_status(order_id='1043') and respond in natural Roman Urdu.",
        },
        {
            "id": "TEST-4",
            "title": "Cart Recovery Discount Flow",
            "query": "Can I get a discount for my abandoned cart? My email is sarah.smith@example.com",
            "expected_behavior": "Should call apply_cart_recovery_discount and return discount code SAVE15 with 15% off.",
        }
    ]

    for test in test_queries:
        print(f"\n🔹 [{test['id']}]: {test['title']}")
        print(f"   👤 User Query: \"{test['query']}\"")
        print(f"   🎯 Expected:   {test['expected_behavior']}")
        print("   " + "-" * 70)
        
        response = run_agent(test["query"], verbose=True, client=client)
        
        print("\n   🤖 Agent Response:")
        # Indent response lines for clean formatting
        for line in response.strip().split("\n"):
            print(f"      {line}")
        print("=" * 75)


def interactive_cli():
    """
    Start an interactive command-line session for testing custom queries.
    """
    print("\n" + "=" * 70)
    print(" 🛍️  AUTONOMOUS E-COMMERCE AI AGENT - LIVE CLI")
    print("=" * 70)
    print(" Type your questions below (English or Roman Urdu).")
    print(" Examples:")
    print("   - 'Where is my order 1042?'")
    print("   - 'Do you have the Classic White T-Shirt in size L?'")
    print("   - 'Mera order 1043 kab deliver hoga?'")
    print("   - 'I left items in my cart, my email is sarah.smith@example.com'")
    print(" Type 'exit', 'quit', or 'q' to end the session.")
    print("=" * 70 + "\n")

    client = get_openai_client()
    chat_history: List[Dict[str, Any]] = []

    while True:
        try:
            user_input = input("\n👤 Customer: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ["exit", "quit", "q"]:
                print("👋 Thank you for visiting! Goodbye.")
                break

            print("\n🤖 AI Agent is processing...")
            response = run_agent(user_input, chat_history=chat_history, verbose=True, client=client)
            print(f"\n🤖 Response:\n{response}\n")

            # Maintain conversation history
            chat_history.append({"role": "user", "content": user_input})
            chat_history.append({"role": "assistant", "content": response})

        except (KeyboardInterrupt, EOFError):
            print("\n👋 Session ended.")
            break


if __name__ == "__main__":
    # If launched with '--cli' flag, run interactive CLI; otherwise run test suite
    if len(sys.argv) > 1 and sys.argv[1] == "--cli":
        interactive_cli()
    else:
        run_automated_tests()
        print("\n💡 Tip: Run `python agent.py --cli` to launch interactive conversation mode.")
