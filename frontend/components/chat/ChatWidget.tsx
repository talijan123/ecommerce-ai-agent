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
}

export function ChatWidget({ initialOpen = false, standalone = false }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(initialOpen || standalone);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showWelcomeToast, setShowWelcomeToast] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or restore session ID from localStorage
  useEffect(() => {
    let currentSession = localStorage.getItem("autocommerce_chat_session_id");
    if (!currentSession) {
      currentSession = "sess_" + Math.random().toString(36).substring(2, 10);
      localStorage.setItem("autocommerce_chat_session_id", currentSession);
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
    return () => {
      window.removeEventListener("open-ai-chat" as any, handleOpenChatEvent as EventListener);
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
      const response = await api.sendChatMessage(sessionId, query, customerEmail || undefined);

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

  // If rendered in standalone mode (e.g. /widget page), fill the container
  if (standalone) {
    return (
      <div className="w-full max-w-3xl mx-auto h-[680px] rounded-3xl border border-zinc-800/90 bg-zinc-950 flex flex-col overflow-hidden shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/20 border border-indigo-400/30">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                AutoCommerce AI Assistant
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </h3>
              <p className="text-[11px] text-zinc-400">Grounded in Live Store DB & OpenAI Tool Calling</p>
            </div>
          </div>
          <Button variant="secondary" size="xs" onClick={handleResetSession} title="Reset Chat">
            <RotateCcw className="h-3 w-3" />
            New Chat
          </Button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-zinc-950/60">
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} onSelectAction={(act) => handleSendMessage(act)} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 border-t border-zinc-800/60 bg-zinc-950/80">
          <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
        </div>

        {/* Optional Email Bar */}
        {showEmailInput && (
          <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-800/80 flex items-center gap-2 text-xs">
            <Mail className="h-3.5 w-3.5 text-zinc-400" />
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

        {/* Input Form */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50">
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
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
            <Button variant="gradient" size="md" type="submit" disabled={!inputMessage.trim() || isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Floating Customer Chat Widget
  return (
    <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50">
      {/* Floating Welcome Toast Tooltip (when closed) */}
      {!isOpen && showWelcomeToast && (
        <div className="absolute bottom-16 right-0 mb-2 w-72 p-3.5 rounded-2xl bg-zinc-900/95 border border-zinc-800/90 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg gradient-blue-indigo flex items-center justify-center text-white shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-white">AI Assistant Online</span>
            </div>
            <button
              onClick={() => setShowWelcomeToast(false)}
              className="text-zinc-400 hover:text-zinc-200 p-0.5"
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
            className="mt-2.5 w-full py-1.5 px-3 rounded-lg gradient-blue-indigo text-[11px] font-semibold text-white hover:opacity-95 transition-opacity"
          >
            Start Chatting →
          </button>
        </div>
      )}

      {/* Floating Trigger Launcher Button (when closed) */}
      {!isOpen && (
        <div className="relative group">
          {/* Animated Glowing Ring Backdrop */}
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

      {/* Expanded Chat Drawer / Window */}
      {isOpen && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-0 sm:right-0 bg-zinc-950/95 border border-zinc-800/90 backdrop-blur-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200",
            isExpanded
              ? "sm:w-[540px] sm:h-[720px] rounded-t-3xl sm:rounded-3xl"
              : "sm:w-[420px] sm:h-[600px] rounded-t-3xl sm:rounded-3xl",
            "h-[88vh] sm:h-auto"
          )}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-900/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 border border-indigo-400/30">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                  AutoCommerce AI
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </h3>
                <span className="text-[10px] text-zinc-400 font-medium">Grounded in Live Store DB</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
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
                title={isExpanded ? "Minimize" : "Expand"}
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
            <div className="px-3.5 py-2 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center gap-2 animate-in fade-in duration-150">
              <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Email for order tracking or cart recovery (e.g. sarah.smith@example.com)"
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

          {/* Messages Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-zinc-950/60">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} onSelectAction={(act) => handleSendMessage(act)} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-3 border-t border-zinc-800/60 bg-zinc-950/80">
            <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/60">
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
                className="h-9 px-3.5"
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
