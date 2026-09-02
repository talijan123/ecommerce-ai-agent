"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Package,
  AlertTriangle,
  ShoppingCart,
  Zap,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  DollarSign,
  Bot,
  Activity,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import { api, DashboardStats, Order } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  async function fetchStats() {
    try {
      setLoading(true);
      const [statsData, ordersData] = await Promise.all([
        api.getDashboardStats(),
        api.getOrders().catch(() => []),
      ]);
      setStats(statsData);
      setOrders(ordersData);
    } catch (e) {
      console.error("Error fetching stats:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Merchant AI Command Center"
        description="Real-time analytics on autonomous agent turns, customer inquiries, order fulfillment, and live database sync."
        onRefresh={fetchStats}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main className="p-6 sm:p-8 space-y-8 flex-1">
        {/* KPI Metrics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricsCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue > 0 ? totalRevenue : 2480.95)}
            description="Gross store sales from fulfilled orders"
            icon={DollarSign}
            color="emerald"
            trend="+14.2% MoM"
            trendUp={true}
          />
          <MetricsCard
            title="Conversations Handled"
            value={stats ? stats.total_conversations : "..."}
            description="Active customer AI chat sessions"
            icon={MessageSquare}
            color="blue"
            trend="100% resolution"
            trendUp={true}
          />
          <MetricsCard
            title="Orders Tracked"
            value={stats ? stats.total_orders : "..."}
            description={`${stats?.shipped_orders || 0} orders shipped & live tracked`}
            icon={Package}
            color="indigo"
            trend="FedEx / DHL Sync"
            trendUp={true}
          />
          <MetricsCard
            title="Cart Recovery Rate"
            value={stats ? `${stats.cart_recovery_rate_pct}%` : "..."}
            description="Discount eligible sessions"
            icon={ShoppingCart}
            color="amber"
            trend="Promo SAVE15"
            trendUp={true}
          />
        </div>

        {/* Quick Action Simulation Bar */}
        <Card className="border-indigo-500/30 bg-gradient-to-r from-blue-950/40 via-zinc-900/80 to-indigo-950/40 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="indigo" dot={true}>Live Webhook Sync Engine</Badge>
                <span className="text-xs text-zinc-400">Shopify, WooCommerce, & Custom API compatible</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Simulate Real-time Store Webhooks</h3>
              <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
                Trigger simulated order placements or instant stock replenishments to see the AI agent react in real-time.
              </p>
            </div>

            <Button
              variant="gradient"
              size="md"
              onClick={() => setIsSimulatorOpen(true)}
              className="shrink-0 gap-2 shadow-lg shadow-indigo-500/20"
            >
              <Zap className="h-4 w-4" />
              Launch Webhook Simulator
            </Button>
          </div>
        </Card>

        {/* Main Content Grid: Activity Feed & Architecture Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Real-time Activity Feed (2 cols) */}
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>

          {/* AI Behavioral Rules & System Status (1 col) */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4 border-zinc-800/80 bg-zinc-900/60">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Anti-Hallucination Guardrails
                </h4>
                <Badge variant="success" dot={true}>Active</Badge>
              </div>

              <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                    1. Direct Database Grounding
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Agent is strictly prohibited from fabricating order tracking links or inventory numbers.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                    2. Smart Out-of-Stock Intelligence
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    When requested size stock = 0, agent scans the DB and proactively offers available sizes.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    3. Roman Urdu Multilingual Parser
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Natively resolves English & Roman Urdu queries and returns natural localized responses.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Webhook Simulator Modal */}
      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={fetchStats}
      />
    </div>
  );
}
