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
} from "lucide-react";
import { Button } from "@/lib/ui";
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
  const [sessionId, setSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          "Hello! 👋 I'm your Autonomous E-Commerce Store Assistant. I can track orders in real-time, check inventory & alternative sizes, apply cart discounts, or answer queries in English & Roman Urdu.\n\nHow can I help you today?",
      },
    ]);
  }, []);

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err?.message || "⚠️ Sorry, I couldn't reach the store server. Please check your connection and try again.",
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
          "Started a fresh conversation! 🛍️ How can I assist you with your orders or shopping today?",
      },
    ]);
  };

  // If rendered in standalone mode (e.g. /widget page), fill the container
  if (standalone) {
    return (
      <div className="w-full max-w-2xl mx-auto h-[650px] rounded-2xl border border-slate-800 bg-slate-950 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Store Assistant
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              </h3>
              <p className="text-[11px] text-slate-400">Grounded in live store database</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleResetSession} title="Reset Chat">
            <RotateCcw className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="px-4 border-t border-slate-800/60 bg-slate-950">
          <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything (e.g. 'Where is order #1042?', 'Size L in stock?')..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
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
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Trigger Button (when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 rounded-full gradient-blue-indigo px-5 py-3.5 text-white shadow-2xl shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all"
        >
          <div className="relative">
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse"></span>
          </div>
          <div className="text-left pr-1">
            <span className="block text-xs font-bold leading-none">AI Support</span>
            <span className="block text-[10px] text-blue-100 opacity-90 mt-0.5">Ask questions & track orders</span>
          </div>
        </button>
      )}

      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] h-[580px] rounded-2xl border border-slate-800/90 bg-slate-950/95 backdrop-blur-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-900/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5 leading-none">
                  Store AI Assistant
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                </h3>
                <span className="text-[10px] text-slate-400">Live Tool Calling Enabled</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetSession}
                title="New Session"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-3 border-t border-slate-800/60 bg-slate-950/80">
            <QuickPrompts onSelectPrompt={(p) => handleSendMessage(p)} disabled={isLoading} />
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about orders, stock, or discounts..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <Button
                variant="gradient"
                size="sm"
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="h-9 px-3"
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
