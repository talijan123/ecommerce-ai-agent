"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  Store,
  Sparkles,
  Smartphone,
  ChevronDown,
  AlertCircle,
  ShieldAlert,
  Code,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { WhatsAppTestModal } from "@/components/dashboard/WhatsAppTestModal";
import { Card, Badge, Button } from "@/lib/ui";
import { api, ConversationSummary, ChatHistoryRecord, StoreResponse } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function ConversationsPage() {
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatHistoryRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "needs_human" | "whatsapp" | "widget">("all");
  const [isTestWhatsAppOpen, setIsTestWhatsAppOpen] = useState(false);
  // On mobile: toggle between "list" and "chat"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Load stores list
  const loadStoresAndData = useCallback(async () => {
    try {
      setLoadingList(true);
      const storesList = await api.listStores().catch(() => []);
      setStores(storesList);

      const targetStoreId = activeStoreId || (storesList.length > 0 ? storesList[0].id : null);
      if (targetStoreId) {
        setActiveStoreId(targetStoreId);
        const list = await api.getConversations(targetStoreId).catch(() => []);
        setConversations(list);
        if (list.length > 0) {
          setSelectedSessionId(list[0].session_id);
        } else {
          setSelectedSessionId(null);
          setSessionMessages([]);
        }
      } else {
        setConversations([]);
        setSelectedSessionId(null);
        setSessionMessages([]);
      }
    } catch (e) {
      console.error("Failed to load stores/conversations:", e);
      setConversations([]);
    } finally {
      setLoadingList(false);
    }
  }, [activeStoreId]);

  async function fetchConversations(storeId?: string) {
    const targetId = storeId || activeStoreId;
    if (!targetId) return;
    try {
      setLoadingList(true);
      const list = await api.getConversations(targetId);
      setConversations(list);
      if (list.length > 0) {
        if (!selectedSessionId || !list.some((c) => c.session_id === selectedSessionId)) {
          setSelectedSessionId(list[0].session_id);
        }
      } else {
        setSelectedSessionId(null);
        setSessionMessages([]);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      setLoadingList(false);
    }
  }

  async function fetchHistory(sessionId: string, storeId?: string) {
    const targetId = storeId || activeStoreId;
    try {
      setLoadingMessages(true);
      const msgs = await api.getChatHistory(sessionId, targetId || undefined);
      setSessionMessages(msgs);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    loadStoresAndData();
  }, [loadStoresAndData]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchHistory(selectedSessionId, activeStoreId || undefined);
    } else {
      setSessionMessages([]);
    }
  }, [selectedSessionId, activeStoreId]);

  const handleStoreChange = (storeId: string) => {
    setActiveStoreId(storeId);
    setSelectedSessionId(null);
    setSessionMessages([]);
    fetchConversations(storeId);
  };

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  const filteredConversations = conversations.filter((c) => {
    const matchesSearch =
      c.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.preview.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === "needs_human") {
      return c.needs_human || c.status === "Needs Human";
    }
    if (filterTab === "whatsapp") {
      return c.channel === "WhatsApp";
    }
    if (filterTab === "widget") {
      return c.channel === "Web Widget";
    }
    return true;
  });

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setMobileView("detail");
  };

  const selectedConv = conversations.find((c) => c.session_id === selectedSessionId);
  const currentSessionNeedsHuman =
    selectedConv?.needs_human ||
    selectedConv?.status === "Needs Human" ||
    sessionMessages.some((m) => m.needs_human);

  return (
    <div className="flex-1 flex flex-col min-h-screen md:h-screen md:overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="Conversations & Support Management"
        description="Monitor multi-turn customer chats, live tool executions, and handle human escalations in real-time."
        onRefresh={() => fetchConversations()}
        onOpenWhatsAppTest={() => setIsTestWhatsAppOpen(true)}
      />

      {/* Store Context Switcher Bar */}
      {stores.length > 1 && (
        <div className="px-4 sm:px-6 pt-3 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-xs">
            <Store className="h-3.5 w-3.5 text-blue-500" />
            <span>Store Context:</span>
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

          <Link href="/dashboard/widget">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Code className="h-3.5 w-3.5 text-indigo-500" />
              <span>Storefront Widget & Embed</span>
            </Button>
          </Link>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden p-4 sm:p-6 gap-4 sm:gap-6 min-h-0">
        {/* Left Sessions List Pane */}
        <div
          className={`w-full md:w-80 lg:w-96 flex flex-col rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/90 overflow-hidden shadow-xl min-h-0 ${
            mobileView === "detail" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Search Header */}
          <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 space-y-2.5">
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

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                  filterTab === "all"
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                onClick={() => setFilterTab("needs_human")}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all shrink-0 ${
                  filterTab === "needs_human"
                    ? "bg-red-500 text-white"
                    : "text-red-500 hover:bg-red-500/10"
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                Needs Human ({conversations.filter((c) => c.needs_human || c.status === "Needs Human").length})
              </button>
              <button
                onClick={() => setFilterTab("whatsapp")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                  filterTab === "whatsapp"
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                WhatsApp
              </button>
              <button
                onClick={() => setFilterTab("widget")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 ${
                  filterTab === "widget"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                Widget
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 custom-scrollbar max-h-[60vh] md:max-h-none min-h-0">
            {loadingList ? (
              <div className="p-8 text-center text-xs text-zinc-500">Loading conversation logs...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">No chat sessions found</p>
                <p className="text-[11px] text-zinc-400">Incoming customer conversations will appear here.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.session_id === selectedSessionId;
                const isNeedsHuman = conv.needs_human || conv.status === "Needs Human";
                return (
                  <button
                    key={conv.session_id}
                    onClick={() => handleSelectSession(conv.session_id)}
                    className={`w-full text-left p-4 transition-all flex flex-col gap-2 min-h-[48px] ${
                      isSelected
                        ? isNeedsHuman
                          ? "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-500"
                          : "bg-blue-50 dark:bg-blue-600/10 border-l-4 border-l-blue-500"
                        : "hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {conv.session_id}
                      </span>
                      {isNeedsHuman ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          Needs Human
                        </span>
                      ) : (
                        <Badge variant="default" className="text-[10px] py-0 px-2 font-mono shrink-0">
                          {conv.message_count} turns
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                      "{conv.preview}"
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="h-3 w-3" />
                        {formatDate(conv.last_active)}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          conv.channel === "WhatsApp"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        }`}>
                          {conv.channel}
                        </span>
                        {conv.tools_used && conv.tools_used.length > 0 && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                            <Wrench className="h-3 w-3" />
                            {conv.tools_used.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Conversation Inspector Pane */}
        <div
          className={`flex-1 flex flex-col rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/90 overflow-hidden shadow-xl min-h-0 ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between gap-2 shrink-0">
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
                  {selectedConv?.channel || "Customer Chat"} &bull; Chronological history with tool-calling payloads
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

          {/* Escalation Alert Banner */}
          {currentSessionNeedsHuman && (
            <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-3 text-red-500 dark:text-red-400 shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0">
                  <span className="font-bold text-xs block">Escalated: Customer Requested Human Support / Manager</span>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400/80 truncate">
                    This conversation is flagged for human intervention and priority support resolution.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold shrink-0">
                Needs Human
              </span>
            </div>
          )}

          {/* Thread Body */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-950/60 min-h-0">
            {loadingMessages ? (
              <div className="p-12 text-center text-xs text-zinc-500">Loading thread records...</div>
            ) : sessionMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md mx-auto my-auto">
                <div className="h-16 w-16 rounded-3xl gradient-blue-indigo flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                  <MessageSquare className="h-8 w-8" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-zinc-900 dark:text-white">
                    No Customer Chats Recorded Yet
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Customer conversations from your Storefront Live Chat Widget and WhatsApp will appear here with complete real-time tool execution logs.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Link href="/dashboard/widget">
                    <Button variant="gradient" size="sm" className="gap-1.5 text-xs min-h-[38px]">
                      <Code className="h-4 w-4" />
                      <span>Test Storefront Widget</span>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsTestWhatsAppOpen(true)}
                    className="gap-1.5 text-xs min-h-[38px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Test on WhatsApp</span>
                  </Button>
                </div>
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

                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {formatDate(msg.created_at)}
                        </span>
                        {msg.needs_human && (
                          <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                            Escalated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Test Modal */}
      {activeStore && (
        <WhatsAppTestModal
          isOpen={isTestWhatsAppOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsTestWhatsAppOpen(false)}
        />
      )}
    </div>
  );
}
