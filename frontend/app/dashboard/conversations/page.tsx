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

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Header
        title="Live AI Chat Logs & Tool Inspector"
        description="Inspect multi-turn conversations, tool calling parameter inputs, and database outputs."
        onRefresh={fetchConversations}
      />

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Sessions List Pane */}
        <div className="w-80 sm:w-96 flex flex-col rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
          {/* Search Header */}
          <div className="p-3.5 border-b border-slate-800 bg-slate-900/60">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search sessions or queries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {loadingList ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading conversation logs...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active conversations found. Try asking a question in the customer chat widget!
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.session_id === selectedSessionId;
                return (
                  <button
                    key={conv.session_id}
                    onClick={() => setSelectedSessionId(conv.session_id)}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-2 ${
                      isSelected
                        ? "bg-blue-600/10 border-l-4 border-l-blue-500"
                        : "hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-white truncate">
                        {conv.session_id}
                      </span>
                      <Badge variant="default" className="text-[10px] py-0 px-2">
                        {conv.message_count} turns
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      "{conv.preview}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(conv.last_active)}
                      </span>

                      {conv.tools_used && conv.tools_used.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-400 font-medium">
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
        <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Session Inspector: <span className="font-mono text-blue-400">{selectedSessionId || "None"}</span>
              </h3>
              <p className="text-xs text-slate-400">Chronological history with tool-calling payloads</p>
            </div>
            {selectedSessionId && (
              <Button variant="outline" size="sm" onClick={() => fetchHistory(selectedSessionId)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Thread
              </Button>
            )}
          </div>

          {/* Thread Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {loadingMessages ? (
              <div className="p-12 text-center text-xs text-slate-500">Loading thread records...</div>
            ) : sessionMessages.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Select a conversation from the left to view the interactive audit trail.
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
                      className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-white ${
                        isUser
                          ? "bg-slate-700 order-2"
                          : isTool
                          ? "bg-amber-600"
                          : "gradient-blue-indigo"
                      }`}
                    >
                      {isUser ? <User className="h-4 w-4" /> : isTool ? <Wrench className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    <div className={`max-w-[78%] space-y-2 ${isUser ? "order-1" : ""}`}>
                      {/* Tool call JSON visualization */}
                      {msg.tool_calls && msg.tool_calls.length > 0 && (
                        <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-950/20 space-y-2">
                          <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                            <Wrench className="h-3.5 w-3.5" />
                            <span>Requested Tool Call:</span>
                          </div>
                          <pre className="p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-blue-200 overflow-x-auto">
                            {JSON.stringify(msg.tool_calls, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Tool response output visualization */}
                      {isTool && (
                        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                          <div className="flex items-center justify-between font-semibold text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Tool Result ({msg.name || "executed"})
                            </span>
                            <span className="font-mono text-[10px] text-emerald-400/80">{msg.tool_call_id}</span>
                          </div>
                          <pre className="p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-emerald-200 overflow-x-auto max-h-48">
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
                              : "rounded-tl-sm bg-slate-900 border border-slate-800 text-slate-200"
                          }`}
                        >
                          {msg.content}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-500 block px-1">
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
