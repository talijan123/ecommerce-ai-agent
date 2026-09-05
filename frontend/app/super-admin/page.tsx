"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users,
  Store,
  Package,
  MessageSquare,
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Zap,
  ArrowLeft,
  Filter,
  Check,
  X,
  Smartphone,
  ShoppingBag,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Card, Badge, Button } from "@/lib/ui";
import {
  api,
  SuperAdminStats,
  SuperAdminTenant,
  TicketResponse,
  getSandboxConnectUrl,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function SuperAdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [tickets, setTickets] = useState<TicketResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tenants" | "tickets" | "system">("tenants");

  // Search & Filter States
  const [tenantSearch, setTenantSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("All");
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const superAdminList = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "aroobjan965@gmail.com,talal@example.com,admin@autocommerce.ai,owner@store.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isSuperAdmin =
    user?.role === "super_admin" ||
    (user?.email && (superAdminList.includes(user.email.toLowerCase()) || user.email.toLowerCase() === "aroobjan965@gmail.com"));

  async function loadSuperAdminData() {
    try {
      setLoading(true);
      const [statsData, tenantsData, ticketsData] = await Promise.all([
        api.getSuperAdminStats().catch(() => null),
        api.getSuperAdminTenants().catch(() => []),
        api.getSuperAdminTickets().catch(() => []),
      ]);

      setStats(statsData);
      setTenants(tenantsData);
      setTickets(ticketsData);
    } catch (err) {
      console.error("Error loading super-admin data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/login");
        return;
      }
      loadSuperAdminData();
    }
  }, [isLoading, isAuthenticated, router]);

  // Filtered tenants by search query
  const filteredTenants = useMemo(() => {
    if (!tenantSearch) return tenants;
    const q = tenantSearch.toLowerCase();
    return tenants.filter(
      (t) =>
        t.store_name.toLowerCase().includes(q) ||
        t.owner_email.toLowerCase().includes(q) ||
        t.whatsapp_phone_number_id.includes(q)
    );
  }, [tenants, tenantSearch]);

  // Filtered tickets by status
  const filteredTickets = useMemo(() => {
    if (ticketStatusFilter === "All") return tickets;
    return tickets.filter((t) => t.status.toLowerCase() === ticketStatusFilter.toLowerCase());
  }, [tickets, ticketStatusFilter]);

  // Handle ticket triage status update
  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      setUpdatingTicketId(ticketId);
      await api.updateSuperAdminTicket(ticketId, {
        status: newStatus,
        resolution_notes: `Status changed to ${newStatus} by platform administrator`,
      });

      // Update local state immediately
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    } finally {
      setUpdatingTicketId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="Super-Admin Platform Console"
        description="Platform owner control center: Multi-tenant store monitoring, WhatsApp messaging throughput, and merchant support triage."
        onRefresh={loadSuperAdminData}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1">
        {/* Top Control Bar: Back to Dashboard & Super-Admin Status */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl md:rounded-3xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Platform Owner Portal</span>
                <Badge variant="default" className="text-[10px] bg-purple-600 text-white font-mono">
                  Full Authority
                </Badge>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Logged in as: <span className="font-mono text-purple-600 dark:text-purple-400">{user?.email}</span>
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors min-h-[38px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Merchant View</span>
          </Link>
        </div>

        {/* 5-Card Platform-Wide KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-5 rounded-3xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Registered Merchants</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {stats?.total_merchants || tenants.length}
            </div>
            <div className="text-[11px] text-zinc-500">Active tenant accounts</div>
          </Card>

          <Card className="p-5 rounded-3xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Active Tenant Stores</span>
              <Store className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {stats?.active_stores || tenants.length}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">100% operational</div>
          </Card>

          <Card className="p-5 rounded-3xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Total Catalog Items</span>
              <Package className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {stats?.total_products || 0}
            </div>
            <div className="text-[11px] text-zinc-500">Across all store databases</div>
          </Card>

          <Card className="p-5 rounded-3xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>WhatsApp Messages</span>
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {stats?.total_whatsapp_messages || 0}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Multi-tenant AI router</div>
          </Card>

          <Card className="p-5 rounded-3xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Open Support Tickets</span>
              <LifeBuoy className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats?.tickets?.open ?? tickets.filter((t) => t.status === "Open").length}
            </div>
            <div className="text-[11px] text-zinc-500">Requiring engineering triage</div>
          </Card>
        </div>

        {/* Sub-Navigation Tabs & Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-200/80 dark:bg-zinc-900 rounded-2xl border border-zinc-300 dark:border-zinc-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab("tenants")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 whitespace-nowrap min-h-[38px] ${
                activeTab === "tenants"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Store className="h-4 w-4" />
              <span>Merchant Tenants ({tenants.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("tickets")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 whitespace-nowrap min-h-[38px] ${
                activeTab === "tickets"
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-500/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <LifeBuoy className="h-4 w-4" />
              <span>Support Inbox ({tickets.length})</span>
            </button>
          </div>

          {/* Search Inputs based on active tab */}
          {activeTab === "tenants" && (
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search store name or email..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              {tenantSearch && (
                <button
                  onClick={() => setTenantSearch("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {activeTab === "tickets" && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {["All", "Open", "In Progress", "Resolved"].map((st) => (
                <button
                  key={st}
                  onClick={() => setTicketStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    ticketStatusFilter === st
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab 1: Merchant Tenants Directory Table */}
        {activeTab === "tenants" && (
          <Card className="p-0 overflow-hidden border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Store Identity</th>
                    <th className="p-4">Merchant Owner</th>
                    <th className="p-4">WhatsApp Phone ID</th>
                    <th className="p-4">Catalog Items</th>
                    <th className="p-4">Integrations</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4 text-right">Direct Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        Loading merchant directory...
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        No merchant stores match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const sandboxUrl = getSandboxConnectUrl(t.store_id);
                      return (
                        <tr key={t.store_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-zinc-900 dark:text-white text-sm">
                              {t.store_name}
                            </div>
                            <span className="font-mono text-[10px] text-zinc-400">{t.store_id}</span>
                          </td>

                          <td className="p-4">
                            <div className="font-semibold text-zinc-900 dark:text-white">{t.owner_name || "Merchant"}</div>
                            <span className="text-zinc-500 font-mono text-[11px]">{t.owner_email}</span>
                          </td>

                          <td className="p-4 font-mono text-zinc-700 dark:text-zinc-300">
                            {t.whatsapp_phone_number_id}
                          </td>

                          <td className="p-4">
                            <Badge
                              variant={t.product_count > 0 ? "success" : "secondary"}
                              className="text-[10px] font-bold"
                            >
                              {t.product_count} products
                            </Badge>
                          </td>

                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {t.integrations && t.integrations.length > 0 ? (
                                t.integrations.map((i) => (
                                  <Badge key={i} variant="indigo" className="text-[10px] uppercase font-mono">
                                    {i}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-zinc-400 text-[11px]">CSV Manual</span>
                              )}
                            </div>
                          </td>

                          <td className="p-4 text-zinc-500 text-[11px] font-mono">
                            {formatDate(t.created_at)}
                          </td>

                          <td className="p-4 text-right">
                            <a
                              href={sandboxUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                            >
                              <Smartphone className="h-3.5 w-3.5" />
                              <span>Test Bot</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 2: Merchant Support & Ticket Inbox */}
        {activeTab === "tickets" && (
          <Card className="p-0 overflow-hidden border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Ticket Subject & Details</th>
                    <th className="p-4">Merchant Email</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4 text-right">Triage Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        Loading support ticket inbox...
                      </td>
                    </tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        No support tickets match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((tk) => {
                      const isUpdating = updatingTicketId === tk.id;
                      return (
                        <tr key={tk.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4 max-w-sm">
                            <div className="font-bold text-zinc-900 dark:text-white text-sm">
                              {tk.subject}
                            </div>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                              {tk.description}
                            </p>
                            {tk.resolution_notes && (
                              <div className="mt-1 text-[11px] text-purple-700 dark:text-purple-300 font-mono bg-purple-500/10 p-1.5 rounded-lg">
                                Resolution: {tk.resolution_notes}
                              </div>
                            )}
                          </td>

                          <td className="p-4 font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                            {tk.user_email}
                          </td>

                          <td className="p-4">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {tk.category}
                            </Badge>
                          </td>

                          <td className="p-4">
                            <Badge
                              variant={
                                tk.priority === "urgent"
                                  ? "destructive"
                                  : tk.priority === "high"
                                  ? "warning"
                                  : "secondary"
                              }
                              className="text-[10px] uppercase font-bold"
                            >
                              {tk.priority}
                            </Badge>
                          </td>

                          <td className="p-4">
                            <Badge
                              variant={
                                tk.status === "Resolved"
                                  ? "success"
                                  : tk.status === "In Progress"
                                  ? "indigo"
                                  : "warning"
                              }
                              dot={true}
                              className="text-[10px] font-bold"
                            >
                              {tk.status}
                            </Badge>
                          </td>

                          <td className="p-4 text-zinc-500 text-[11px] font-mono">
                            {formatDate(tk.created_at)}
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {tk.status !== "In Progress" && tk.status !== "Resolved" && (
                                <button
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateTicketStatus(tk.id, "In Progress")}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
                                >
                                  In Progress
                                </button>
                              )}

                              {tk.status !== "Resolved" && (
                                <button
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateTicketStatus(tk.id, "Resolved")}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Resolve</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
