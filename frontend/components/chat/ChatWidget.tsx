"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  Minimize2,
  Maximize2,
  ChevronDown,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button, Badge } from "@/lib/ui";
import { api, ToolInvocationLog } from "@/lib/api";
import { ChatMessage, MessageItem } from "./ChatMessage";
import { QuickPrompts } from "./QuickPrompts";
import { TypingIndicator } from "./TypingIndicator";
import { cn } from "@/lib/utils";

interface ChatWidgetProps {
  initialOpen?: boolean;
  standalone?: boolean;
  embed?: boolean;
  storeId?: string;
  themeColor?: string;
}

export function ChatWidget({
  initialOpen = false,
  standalone = false,
  embed = false,
  storeId,
  themeColor,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(initialOpen || standalone || embed);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(!embed && !standalone);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or restore session ID from localStorage
  useEffect(() => {
    const storageKey = storeId ? `autocommerce_chat_session_${storeId}` : "autocommerce_chat_session_id";
    let currentSession = localStorage.getItem(storageKey);
    if (!currentSession) {
      currentSession = "sess_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(storageKey, currentSession);
    }
    setSessionId(currentSession);


    // Initial greeting
    setMessages([
      {
        role: "assistant",
        content:
          "Hello! 👋 I'm your **AutoCommerce Autonomous AI Store Assistant**.\n\nI am grounded in live store databases to help you:\n• 📦 **Track orders** in real-time with live carrier links\n• 👟 **Check inventory & smart alternative sizes** when items are out-of-stock\n• 🏷️ **Apply abandoned cart discounts**\n• 🌐 Understand queries in both **English & Roman Urdu**\n\nHow can I help you today?",
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  // Listen for custom open-chat events triggered from product cards or hero buttons
  useEffect(() => {
    const handleOpenChatEvent = (e: CustomEvent<{ prompt?: string; email?: string }>) => {
      setIsOpen(true);
      setShowWelcomeToast(false);
      if (e.detail?.email) {
        setCustomerEmail(e.detail.email);
        setShowEmailInput(true);
      }
      if (e.detail?.prompt) {
        setTimeout(() => {
          handleSendMessage(e.detail.prompt);
        }, 150);
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 200);
      }
    };

    window.addEventListener("open-ai-chat" as any, handleOpenChatEvent as EventListener);

    // Listen for iframe postMessage from parent storefront (proactive nudge engine)
    const handlePostMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || typeof data !== "object") return;

        if (data.type === "autocommerce:proactive_greet" || data.action === "proactive_greet") {
          setIsOpen(true);
          setShowWelcomeToast(false);
          const productTitle = data.productTitle || "";
          const greetingText = productTitle
            ? `Hi there! 👋 I noticed you're browsing **${productTitle}**.\n\nWould you like help with choosing the right size, checking delivery to your address, or current stock availability? Ask me anything!`
            : data.prompt
            ? `Hi! 👋 ${data.prompt}`
            : "Hi there! 👋 How can I help you find the perfect item or answer questions about your order today?";

          setMessages((prev) => {
            // Avoid adding greeting twice if already present
            if (prev.some((m) => m.content === greetingText)) return prev;
            return [
              ...prev,
              {
                role: "assistant",
                content: greetingText,
                created_at: new Date().toISOString(),
              },
            ];
          });

          setTimeout(() => {
            inputRef.current?.focus();
          }, 250);
        }
      } catch (err) {
        console.error("Error processing postMessage:", err);
      }
    };

    window.addEventListener("message", handlePostMessage);

    return () => {
      window.removeEventListener("open-ai-chat" as any, handleOpenChatEvent as EventListener);
      window.removeEventListener("message", handlePostMessage);
    };
  }, [sessionId, customerEmail, isLoading]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    // Add user message
    const userMsg: MessageItem = {
      role: "user",
      content: query,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(sessionId, query, customerEmail || undefined, storeId);

      const assistantMsg: MessageItem = {

        role: "assistant",
        content: response.response,
        tools_invoked: response.tools_invoked,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg =
        err?.message && err.message.trim() !== "" && err.message !== "Chat API error: "
          ? err.message
          : "⚠️ Unable to connect to the store backend. Please verify your connection or backend status.";

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

  const handleResetSession = () => {
    const newSession = "sess_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("autocommerce_chat_session_id", newSession);
    setSessionId(newSession);
    setMessages([
      {
        role: "assistant",
        content:
          "Started a fresh conversation! 🛍️ What would you like to explore in the store catalog or order lookup?",
        created_at: new Date().toISOString(),
      },
    ]);
  };

  // If rendered in standalone or embed mode (e.g. /widget iframe on Shopify storefront or standalone preview)
  if (standalone) {
    return (
      <div
        className={cn(
          "bg-zinc-950 flex flex-col min-h-0 overflow-hidden",
          embed
            ? "w-full h-full border-0 rounded-none"
            : "w-full max-w-xl mx-auto h-[580px] max-h-[calc(100vh-120px)] rounded-2xl border border-zinc-800/90 shadow-2xl backdrop-blur-2xl"
        )}
      >
        {/* Header - Fixed top */}
        <div className="shrink-0 p-3 sm:p-3.5 border-b border-zinc-800/80 bg-zinc-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/20 border border-indigo-400/30 shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-none truncate">
                AutoCommerce AI Assistant
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              </h3>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">Grounded in Live Store DB</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="xs"
              onClick={handleResetSession}
              title="Reset Chat"
              className="h-7 px-2 text-[11px] rounded-lg"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              New
            </Button>
          </div>
        </div>

        {/* Message Stream - Flex-1 auto scroll without clipping */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3 bg-zinc-950/60 custom-scrollbar">
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} onSelectAction={(act) => handleSendMessage(act)} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Suggestions - Fixed bottom strip */}
        <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/90">
          <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
        </div>

        {/* Optional Email Bar */}
        {showEmailInput && (
          <div className="shrink-0 px-3 py-1.5 bg-zinc-900/90 border-t border-zinc-800/80 flex items-center gap-2 text-xs">
            <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="Your email (for cart discount or order lookup)..."
              className="flex-1 bg-transparent border-none text-zinc-200 placeholder:text-zinc-500 text-xs focus:outline-none"
            />
            <button
              onClick={() => setShowEmailInput(false)}
              className="text-zinc-400 hover:text-zinc-200 text-[11px]"
            >
              Hide
            </button>
          </div>
        )}

        {/* Input Form - Flush at the very bottom with zero dead space */}
        <div className="shrink-0 mt-auto p-3 border-t border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md">
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
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything (e.g. 'Where is order #1042?', 'Size L in stock?')..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors shadow-inner"
            />
            <Button
              variant="gradient"
              size="md"
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="h-9 px-3.5 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Floating Customer Chat Widget (when used inside dashboard or regular client page)
  return (
    <div className="fixed bottom-0 sm:bottom-6 right-0 sm:right-6 z-50">
      {/* Floating Welcome Toast Tooltip (when closed) */}
      {!isOpen && showWelcomeToast && (
        <div className="absolute bottom-16 right-4 sm:right-0 mb-2 w-72 p-3.5 rounded-2xl bg-zinc-900/95 border border-zinc-800/90 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg gradient-blue-indigo flex items-center justify-center text-white shrink-0 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-white">AI Assistant Online</span>
            </div>
            <button
              onClick={() => setShowWelcomeToast(false)}
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded-md hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-zinc-300 mt-2 leading-relaxed">
            Need real-time order tracking, out-of-stock size recommendations, or cart discount codes?
          </p>
          <button
            onClick={() => {
              setShowWelcomeToast(false);
              setIsOpen(true);
            }}
            className="mt-2.5 w-full py-1.5 px-3 rounded-xl gradient-blue-indigo text-[11px] font-semibold text-white hover:opacity-95 transition-opacity shadow-sm"
          >
            Start Chatting →
          </button>
        </div>
      )}

      {/* Floating Trigger Launcher Button (when closed) */}
      {!isOpen && (
        <div className="p-4 sm:p-0 relative group">
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-70 blur-md group-hover:opacity-100 group-hover:blur-lg transition-all duration-300 animate-pulse-slow" />

          <button
            onClick={() => {
              setShowWelcomeToast(false);
              setIsOpen(true);
            }}
            className="relative flex items-center gap-3 rounded-full bg-zinc-950 px-5 py-3.5 text-white border border-zinc-700/60 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <div className="relative flex items-center justify-center">
              <div className="h-8 w-8 rounded-full gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950 animate-pulse" />
            </div>
            <div className="text-left pr-1">
              <span className="block text-xs font-bold leading-none tracking-tight">AI Agent</span>
              <span className="block text-[10px] text-zinc-400 mt-0.5">Live store assistant</span>
            </div>
          </button>
        </div>
      )}

      {/* Expanded Chat Drawer / Window with Clean Flex Layout */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-zinc-950/95 border border-zinc-800/90 backdrop-blur-2xl shadow-2xl shadow-black/80 flex flex-col min-h-0 overflow-hidden animate-in zoom-in-95 duration-200 z-50 rounded-2xl",
            isExpanded
              ? "w-[calc(100vw-32px)] sm:w-[500px] h-[580px] max-h-[calc(100vh-120px)]"
              : "w-[calc(100vw-32px)] sm:w-[400px] md:w-[420px] h-[580px] max-h-[calc(100vh-120px)]"
          )}
        >
          {/* Header - Fixed at Top */}
          <div className="shrink-0 z-10 sticky top-0 p-3 sm:p-3.5 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 border border-indigo-400/30 shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none truncate">
                  AutoCommerce AI
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                </h3>
                <span className="text-[10px] text-zinc-400 font-medium truncate block mt-0.5">Grounded in Live Store DB</span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowEmailInput(!showEmailInput)}
                title="Toggle customer email input"
                className={cn(
                  "p-1.5 rounded-lg transition-colors text-xs",
                  showEmailInput || customerEmail
                    ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Mail className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={handleResetSession}
                title="New Session"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? "Standard Size" : "Expand Size"}
                className="hidden sm:inline-flex p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Optional Customer Email Drawer */}
          {showEmailInput && (
            <div className="shrink-0 px-3.5 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center gap-2 animate-in fade-in duration-150">
              <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email for order tracking or cart recovery (e.g. customer@example.com)"
                className="flex-1 bg-transparent border-none text-zinc-200 placeholder:text-zinc-500 text-[11px] focus:outline-none"
              />
              {customerEmail && (
                <button
                  onClick={() => setCustomerEmail("")}
                  className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Messages Body - Takes Remaining Space with Internal Scroll without clipping */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3 bg-zinc-950/60 custom-scrollbar">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} onSelectAction={(act) => handleSendMessage(act)} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/90">
            <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
          </div>

          {/* Input Footer - Flush at bottom with zero dead space */}
          <div className="shrink-0 mt-auto sticky bottom-0 p-3 border-t border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md">
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
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about orders, stock, sizes, or discounts..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/70 transition-colors shadow-inner"
              />
              <Button
                variant="gradient"
                size="sm"
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="h-9 px-3.5 shrink-0 rounded-xl"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
