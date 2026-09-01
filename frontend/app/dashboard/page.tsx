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
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import { api, DashboardStats } from "@/lib/api";

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  async function fetchStats() {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error("Error fetching stats:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Merchant AI Overview"
        description="Monitor autonomous agent operations, customer conversations, and store data sync."
        onRefresh={fetchStats}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main className="p-8 space-y-8 flex-1">
        {/* KPI Metrics Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricsCard
            title="Conversations Handled"
            value={stats ? stats.total_conversations : "..."}
            description="Active customer AI chat sessions"
            icon={MessageSquare}
            color="blue"
            trend="+100% resolution"
            trendUp={true}
          />
          <MetricsCard
            title="Orders Tracked"
            value={stats ? stats.total_orders : "..."}
            description={`${stats?.shipped_orders || 0} orders shipped & tracked`}
            icon={Package}
            color="indigo"
            trend="FedEx / DHL"
            trendUp={true}
          />
          <MetricsCard
            title="Cart Recovery Rate"
            value={stats ? `${stats.cart_recovery_rate_pct}%` : "..."}
            description="Discount eligible sessions"
            icon={ShoppingCart}
            color="emerald"
            trend="Promo SAVE15"
            trendUp={true}
          />
          <MetricsCard
            title="Low Stock Alerts"
            value={stats ? stats.low_stock_alerts : "..."}
            description="Items with variant stock = 0"
            icon={AlertTriangle}
            color="amber"
            trend="Auto-suggest active"
            trendUp={false}
          />
        </div>

        {/* Quick Action Simulation Bar */}
        <Card className="border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-indigo-950/40 p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="indigo">Live Webhook Testing</Badge>
                <span className="text-xs text-slate-400">Shopify & WooCommerce compatible</span>
              </div>
              <h3 className="text-lg font-bold text-white">Simulate Real-time Store Webhooks</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Test the backend webhook endpoints to instantly inject new orders into the database or update product stock levels without needing an external store setup.
              </p>
            </div>

            <Button
              variant="gradient"
              size="md"
              onClick={() => setIsSimulatorOpen(true)}
              className="shrink-0"
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
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Anti-Hallucination Guardrails
                </h4>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-semibold text-white block mb-0.5">1. Database Grounding:</span>
                  Agent is strictly prohibited from fabricating order tracking links or inventory numbers.
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-semibold text-white block mb-0.5">2. Smart Out-of-Stock Fallback:</span>
                  When requested size stock = 0, agent proactively scans the DB and offers in-stock sizes.
                </div>

                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="font-semibold text-white block mb-0.5">3. Multilingual Intent Parser:</span>
                  Natively resolves English & Roman Urdu queries and returns natural Roman Urdu responses.
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
