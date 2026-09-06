"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  Store,
  Package,
  Wrench,
  MessageSquare,
  ShieldCheck,
  Zap,
  Mail,
  Smartphone,
  ExternalLink,
  ChevronDown,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { WhatsAppTestModal } from "@/components/dashboard/WhatsAppTestModal";
import { ChatMessage, MessageItem } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { Card, Button, Badge } from "@/lib/ui";
import { api, StoreResponse, Product, ToolInvocationLog } from "@/lib/api";

const QUICK_TEST_PROMPTS = [
  {
    category: "👟 Inventory & Size",
    prompts: [
      "Do you have running shoes in size 10?",
      "Which products are currently in stock?",
      "What is your cheapest available item?",
    ],
  },
  {
    category: "📦 Order Tracking",
    prompts: [
      "What is the status of order #1001?",
      "Track my delivery for order #1002",
    ],
  },
  {
    category: "🏷️ Cart Recovery & Deals",
    prompts: [
      "I have items left in my cart, can you offer a discount?",
      "Do you have any active promotional codes?",
    ],
  },
  {
    category: "🌐 Roman Urdu / Bilingual",
    prompts: [
      "Yeh sneaker stock mein available hai?",
      "Mera order 1001 kab tak deliver hoga?",
      "Discount code mil sakta hai?",
    ],
  },
];

export default function AiBotPlaygroundPage() {
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [isTestWhatsAppOpen, setIsTestWhatsAppOpen] = useState(false);
  const [allToolLogs, setAllToolLogs] = useState<Array<{ timestamp: string; tools: ToolInvocationLog[] }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Session ID
  const initSession = () => {
    const newSession = "play_" + Math.random().toString(36).substring(2, 10);
    setSessionId(newSession);
    setMessages([
      {
        role: "assistant",
        content:
          "👋 Welcome to the **AutoCommerce AI Bot Playground**!\n\nThis sandbox runs against your store's live catalog, orders, and cart recovery database.\n\n**Test Capabilities:**\n• 📦 Real-time order lookup & carrier status\n• 👟 Dynamic inventory check & alternative variant suggestions\n• 🏷️ Abandoned cart recovery discount generation\n• 🌐 Multi-language understanding (**English & Roman Urdu**)\n\nTry sending a message or select one of the quick test prompts below.",
        created_at: new Date().toISOString(),
      },
    ]);
    setAllToolLogs([]);
  };

  // Load merchant stores
  useEffect(() => {
    async function loadStores() {
      try {
        const storeList = await api.listStores().catch(() => []);
        setStores(storeList);
        if (storeList.length > 0) {
          setActiveStoreId(storeList[0].id);
          // Fetch store products summary
          api.getProducts(storeList[0].id).then(setProducts).catch(() => setProducts([]));
        }
      } catch (err) {
        console.error("Failed to load stores in AI Bot Playground:", err);
      }
    }
    loadStores();
    initSession();
  }, []);

  // Handle store context change
  const handleStoreChange = (storeId: string) => {
    setActiveStoreId(storeId);
    api.getProducts(storeId).then(setProducts).catch(() => setProducts([]));
    initSession();
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: MessageItem = {
      role: "user",
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(
        sessionId,
        query,
        customerEmail || undefined,
        activeStoreId || undefined
      );

      const assistantMsg: MessageItem = {
        role: "assistant",
        content: response.response,
        tools_invoked: response.tools_invoked,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (response.tools_invoked && response.tools_invoked.length > 0) {
        setAllToolLogs((prev) => [
          { timestamp: new Date().toLocaleTimeString(), tools: response.tools_invoked },
          ...prev,
        ]);
      }
    } catch (err: any) {
      const errMsg =
        err?.message && err.message.trim() !== ""
          ? err.message
          : "⚠️ Agent execution error. Please verify store backend connectivity.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errMsg,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  return (
    <div className="flex-1 flex flex-col min-h-screen md:h-screen md:overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="AI Agent Playground"
        description="Interact directly with your autonomous AI shopping assistant grounded in your live store database."
        onOpenWhatsAppTest={() => setIsTestWhatsAppOpen(true)}
      />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 gap-4 sm:gap-6 md:overflow-hidden">
        {/* Left / Center: Interactive Chat Interface */}
        <div className="flex-1 flex flex-col rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/90 shadow-xl overflow-hidden min-h-[550px]">
          {/* Playground Control Bar */}
          <div className="p-3.5 sm:p-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-sm">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Store Agent</h3>
                  <Badge variant="success" className="text-[10px] py-0 px-2 font-mono">
                    Live
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                  Session: {sessionId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Store Context Switcher */}
              {stores.length > 0 && (
                <div className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 shadow-xs">
                  <Store className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <select
                    value={activeStoreId || ""}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900">
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset Session */}
              <Button
                variant="outline"
                size="sm"
                onClick={initSession}
                className="gap-1.5 text-xs h-8 px-2.5"
                title="Start a fresh conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </Button>

              {/* Customer Email Toggle */}
              <Button
                variant={showEmailInput ? "primary" : "outline"}
                size="sm"
                onClick={() => setShowEmailInput(!showEmailInput)}
                className="gap-1.5 text-xs h-8 px-2.5"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Simulate Customer</span>
              </Button>
            </div>
          </div>

          {/* Optional Customer Email Simulation Bar */}
          {showEmailInput && (
            <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2 text-xs">
              <span className="text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                Simulated Customer Email:
              </span>
              <input
                type="email"
                placeholder="customer@example.com (for order & cart lookups)"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {customerEmail && (
                <button
                  type="button"
                  onClick={() => setCustomerEmail("")}
                  className="text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Chat Messages Container */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/60">
            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg}
                onSelectAction={(actionText) => handleSendMessage(actionText)}
              />
            ))}

            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Starter Pills (Horizontally Scrollable) */}
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 shrink-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                Quick Prompts:
              </span>
              {QUICK_TEST_PROMPTS.flatMap((grp) => grp.prompts.slice(0, 1)).map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(promptText)}
                  disabled={isLoading}
                  className="shrink-0 px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shadow-xs"
                >
                  {promptText}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about inventory, track orders, or test Roman Urdu..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <Button
                type="submit"
                variant="gradient"
                disabled={!inputMessage.trim() || isLoading}
                className="h-10 px-4 rounded-xl shrink-0"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5 text-xs">Send</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Testing Hub & Live Tool Execution Logs */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          {/* Active Store Context Card */}
          <Card className="p-4 bg-white dark:bg-zinc-950/90 border-zinc-200 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-blue-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Active Catalog Context</h4>
              </div>
              <Badge variant="default" className="text-[10px] font-mono">
                {products.length} Products
              </Badge>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs">
              <p className="font-semibold text-zinc-900 dark:text-white truncate">
                {activeStore ? activeStore.name : "Active Store"}
              </p>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                Store ID: {activeStore ? activeStore.id : "None"}
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Link href="/dashboard/catalog" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-8">
                  <Package className="h-3 w-3" />
                  <span>View Catalog</span>
                </Button>
              </Link>
              <Link href="/dashboard/conversations" className="flex-1">
                <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-8">
                  <MessageSquare className="h-3 w-3" />
                  <span>Chat Logs</span>
                </Button>
              </Link>
            </div>
          </Card>

          {/* Test Scenarios & Prompts */}
          <Card className="p-4 bg-white dark:bg-zinc-950/90 border-zinc-200 dark:border-zinc-800/80 space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Scenario Prompts</h4>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-60 lg:max-h-72">
              {QUICK_TEST_PROMPTS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {group.category}
                  </span>
                  <div className="space-y-1">
                    {group.prompts.map((p, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => handleSendMessage(p)}
                        disabled={isLoading}
                        className="w-full text-left p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 transition-colors line-clamp-1"
                      >
                        "{p}"
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Real-time Tool Call Activity Log */}
          <Card className="p-4 bg-white dark:bg-zinc-950/90 border-zinc-200 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Live Tool Executions</h4>
              </div>
              <Badge variant="default" className="text-[10px] font-mono">
                {allToolLogs.reduce((acc, l) => acc + l.tools.length, 0)} Invocations
              </Badge>
            </div>

            {allToolLogs.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-zinc-400 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800">
                Send an inventory or order tracking query to see backend tool executions live.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {allToolLogs.map((logEntry, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {logEntry.tools.map((t) => t.tool_name).join(", ")}
                      </span>
                      <span className="font-mono">{logEntry.timestamp}</span>
                    </div>
                    {logEntry.tools.map((tool, tIdx) => (
                      <div key={tIdx} className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200/50 dark:border-zinc-800/50 overflow-x-auto text-zinc-600 dark:text-zinc-300">
                        Args: {JSON.stringify(tool.arguments)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* WhatsApp Simulator Modal */}
      <WhatsAppTestModal
        isOpen={isTestWhatsAppOpen}
        storeId={activeStore ? activeStore.id : undefined}
        storeName={activeStore ? activeStore.name : "Store Assistant"}
        onClose={() => setIsTestWhatsAppOpen(false)}
      />
    </div>
  );
}
