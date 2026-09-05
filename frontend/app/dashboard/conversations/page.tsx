"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Search,
  Wrench,
  Bot,
  User,
  Clock,
  Filter,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Card, Badge, Button } from "@/lib/ui";
import { api, ConversationSummary, ChatHistoryRecord } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatHistoryRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // On mobile: toggle between "list" and "chat"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  async function fetchConversations() {
    try {
      setLoadingList(true);
      const list = await api.getConversations();
      setConversations(list);
      if (list.length > 0 && !selectedSessionId) {
        setSelectedSessionId(list[0].session_id);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      setLoadingList(false);
    }
  }

  async function fetchHistory(sessionId: string) {
    try {
      setLoadingMessages(true);
      const msgs = await api.getChatHistory(sessionId);
      setSessionMessages(msgs);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchHistory(selectedSessionId);
    }
  }, [selectedSessionId]);

  const filteredConversations = conversations.filter(
    (c) =>
      c.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.preview.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMobileView("detail");
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen md:h-screen md:overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="Live AI Chat Logs & Tool Inspector"
        description="Inspect multi-turn conversations, tool calling parameter inputs, and database outputs in real-time."
        onRefresh={fetchConversations}
      />

      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden p-4 sm:p-6 gap-4 sm:gap-6">
        {/* Left Sessions List Pane */}
        <div
          className={`w-full md:w-80 lg:w-96 flex flex-col rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/90 overflow-hidden shadow-xl ${
            mobileView === "detail" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search Header */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sessions or queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 custom-scrollbar max-h-[60vh] md:max-h-none">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-zinc-500">Loading conversation logs...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No active conversations found. Try asking a question in the customer chat widget!
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.session_id === selectedSessionId;
                return (
                  <button
                    key={conv.session_id}
                    onClick={() => handleSelectSession(conv.session_id)}
                    className={`w-full text-left p-4 transition-all flex flex-col gap-2 min-h-[48px] ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-600/10 border-l-4 border-l-blue-500"
                        : "hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {conv.session_id}
                      </span>
                      <Badge variant="default" className="text-[10px] py-0 px-2 font-mono shrink-0">
                        {conv.message_count} turns
                      </Badge>
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                      "{conv.preview}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        {formatDate(conv.last_active)}
                      </span>

                      {conv.tools_used && conv.tools_used.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                          <Wrench className="h-3 w-3" />
                          {conv.tools_used.length} tool(s)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Conversation Inspector Pane */}
        <div
          className={`flex-1 flex flex-col rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/90 overflow-hidden shadow-xl ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Back button on mobile */}
              <button
                onClick={() => setMobileView("list")}
                className="md:hidden p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 shrink-0"
                aria-label="Back to sessions list"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                  Session: <span className="font-mono text-blue-600 dark:text-blue-400 truncate">{selectedSessionId || "None"}</span>
                </h3>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  Chronological history with tool-calling payloads
                </p>
              </div>
            </div>

            {selectedSessionId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchHistory(selectedSessionId)}
                className="text-xs gap-1.5 shrink-0 h-9"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingMessages ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh Thread</span>
              </Button>
            )}
          </div>

          {/* Thread Body */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/60 min-h-[50vh]">
            {loadingMessages ? (
              <div className="p-12 text-center text-xs text-zinc-500">Loading thread records...</div>
            ) : sessionMessages.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-500">
                Select a conversation to view the interactive audit trail.
              </div>
            ) : (
              sessionMessages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isTool = msg.role === "tool";
                const isAssistant = msg.role === "assistant";

                return (
                  <div
                    key={idx}
                    className={`flex gap-3 text-xs leading-relaxed ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
                        isUser
                          ? "bg-zinc-600 dark:bg-zinc-700 order-2"
                          : isTool
                          ? "bg-amber-600"
                          : "gradient-blue-indigo"
                      }`}
                    >
                      {isUser ? <User className="h-3.5 w-3.5" /> : isTool ? <Wrench className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>

                    <div className={`max-w-[85%] sm:max-w-[78%] space-y-2 ${isUser ? "order-1" : ""}`}>
                      {/* Tool call JSON visualization */}
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="p-3.5 rounded-2xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                            <Wrench className="h-3.5 w-3.5" />
                            <span>Requested Tool Call:</span>
                          </div>
                          <pre className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] text-blue-900 dark:text-blue-200 overflow-x-auto">
                            {JSON.stringify(msg.tool_calls, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Tool response output visualization */}
                      {isTool && (
                        <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 space-y-2">
                          <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Tool Result ({msg.name || "executed"})
                            </span>
                            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400/80">{msg.tool_call_id}</span>
                          </div>
                          <pre className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono text-[10px] text-emerald-900 dark:text-emerald-200 overflow-x-auto max-h-48">
                            {msg.content}
                          </pre>
                        </div>
                      )}

                      {/* Regular message content */}
                      {msg.content && !isTool && (
                        <div
                          className={`rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed shadow-sm ${
                            isUser
                              ? "rounded-tr-sm bg-blue-600 text-white"
                              : "rounded-tl-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/90 text-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {msg.content}
                        </div>
                      )}

                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block px-1 font-mono">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
