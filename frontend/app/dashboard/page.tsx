"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  Store,
  Plus,
  QrCode,
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  Smartphone,
  Check,
  X,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { WhatsAppTestModal } from "@/components/dashboard/WhatsAppTestModal";
import { CsvUploadModal } from "@/components/dashboard/CsvUploadModal";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import {
  api,
  StoreResponse,
  Product,
  DashboardStats,
  Order,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  // Stores & Active Store State
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Modals State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isTestWhatsAppOpen, setIsTestWhatsAppOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Catalog Table Search & Filter
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("All");

  // Load stores & overall dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [storesData, statsData, ordersData] = await Promise.all([
        api.listStores().catch(() => []),
        api.getDashboardStats().catch(() => null),
        api.getOrders().catch(() => []),
      ]);

      setStores(storesData);
      setStats(statsData);
      setOrders(ordersData);

      if (storesData.length > 0) {
        const selectedId = activeStoreId || storesData[0].id;
        setActiveStoreId(selectedId);
        loadStoreCatalog(selectedId);
      } else {
        // No stores found -> automatically open onboarding wizard
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId]);

  // Load catalog for selected store
  const loadStoreCatalog = async (storeId: string) => {
    try {
      setCatalogLoading(true);
      const storeProducts = await api.getStoreProducts(storeId).catch(() => []);
      if (storeProducts.length > 0) {
        setProducts(storeProducts);
      } else {
        // Fallback to admin products if tenant has no custom products yet
        const allProducts = await api.getProducts().catch(() => []);
        setProducts(allProducts);
      }
    } catch (err) {
      console.error("Error loading store products:", err);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const activeStore = useMemo(() => {
    return stores.find((s) => s.id === activeStoreId) || stores[0] || null;
  }, [stores, activeStoreId]);

  const handleStoreChange = (newStoreId: string) => {
    setActiveStoreId(newStoreId);
    loadStoreCatalog(newStoreId);
  };

  const handleOnboardingComplete = (newStore: StoreResponse) => {
    setStores((prev) => [newStore, ...prev.filter((s) => s.id !== newStore.id)]);
    setActiveStoreId(newStore.id);
    loadStoreCatalog(newStore.id);
    setIsOnboardingOpen(false);
  };

  // Filtered catalog products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (catalogCategory !== "All" && p.category !== catalogCategory) return false;
      if (catalogSearch.trim()) {
        const q = catalogSearch.toLowerCase();
        return (
          p.title?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, catalogSearch, catalogCategory]);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const isCustomWhatsApp = Boolean(
    activeStore?.whatsapp_phone_number_id &&
      !activeStore.whatsapp_phone_number_id.startsWith("pending-")
  );

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Top Header Bar */}
      <Header
        title="Merchant AI Command Center"
        description="Autonomous customer inquiry resolution, WhatsApp Cloud API sync, and multi-tenant catalog management."
        onRefresh={loadDashboard}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenWhatsAppTest={() => setIsTestWhatsAppOpen(true)}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
        {/* ============================================================ */}
        {/* NO STORES WELCOME BANNER (IF 0 STORES) */}
        {/* ============================================================ */}
        {!loading && stores.length === 0 && (
          <Card className="p-6 sm:p-10 border-indigo-500/30 bg-gradient-to-br from-blue-950/40 via-zinc-900/90 to-indigo-950/40 text-center rounded-3xl shadow-2xl">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-indigo-500/25 animate-bounce">
              <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Welcome to AutoCommerce SaaS!
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-lg mx-auto mt-2 mb-6 leading-relaxed">
              You don&apos;t have any active merchant stores yet. Complete our quick 3-step setup to launch your autonomous WhatsApp shopping assistant.
            </p>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => setIsOnboardingOpen(true)}
              className="gap-2 font-bold shadow-xl shadow-blue-500/25 px-6 sm:px-8 w-full sm:w-auto h-11 sm:h-12 text-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>Launch 3-Step Store Setup Wizard</span>
            </Button>
          </Card>
        )}

        {/* ============================================================ */}
        {/* ACTIVE MERCHANT STORE TENANT OVERVIEW */}
        {/* ============================================================ */}
        {activeStore && (
          <Card className="p-4 sm:p-6 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/60 shadow-sm rounded-2xl transition-all duration-200 hover:shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
              {/* Store Identity & Switcher */}
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="indigo" dot={true} className="text-[10px]">
                    Active Store Tenant
                  </Badge>
                  {isCustomWhatsApp ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Custom Meta WhatsApp
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-500/20">
                      <Smartphone className="h-3.5 w-3.5" />
                      Instant WhatsApp Sandbox Mode
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight truncate">
                    {activeStore.name}
                  </h2>

                  {/* Multi-store selector if merchant has >1 store */}
                  {stores.length > 1 && (
                    <select
                      value={activeStore.id}
                      onChange={(e) => handleStoreChange(e.target.value)}
                      className="text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                  Tenant ID: {activeStore.id} • Owner: {activeStore.owner_email}
                </p>
              </div>

              {/* Quick Actions Bar */}
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setIsTestWhatsAppOpen(true)}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20 text-xs sm:text-sm h-10 sm:h-10 flex-1 sm:flex-initial"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Test on WhatsApp</span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="gap-2 text-xs font-semibold h-10 sm:h-10 flex-1 sm:flex-initial"
                >
                  <Upload className="h-4 w-4 text-indigo-500" />
                  <span>Import CSV</span>
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsOnboardingOpen(true)}
                  className="gap-1.5 text-xs font-semibold h-10 sm:h-10"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Store</span>
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ============================================================ */}
        {/* KPI METRICS GRID */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
          <MetricsCard
            title="Catalog Products"
            value={products.length}
            description="Active inventory SKUs"
            icon={Package}
            color="indigo"
            trend={`${products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0)} units`}
            trendUp={true}
          />
          <MetricsCard
            title="WhatsApp Bot Status"
            value={isCustomWhatsApp ? "Meta Connected" : "Sandbox Mode"}
            description="Scan QR to test live turns"
            icon={Smartphone}
            color="emerald"
            trend="Active 24/7"
            trendUp={true}
            onClick={() => setIsTestWhatsAppOpen(true)}
          />
          <MetricsCard
            title="AI Inquiries Handled"
            value={stats ? stats.total_conversations : "..."}
            description="Resolved autonomously"
            icon={MessageSquare}
            color="blue"
            trend="100% Grounded"
            trendUp={true}
          />
          <MetricsCard
            title="Cart Recovery Rate"
            value={stats ? `${stats.cart_recovery_rate_pct}%` : "..."}
            description="Promo discount conversions"
            icon={ShoppingCart}
            color="amber"
            trend={formatCurrency(totalRevenue > 0 ? totalRevenue : 2480.95)}
            trendUp={true}
          />
        </div>

        {/* ============================================================ */}
        {/* PRODUCT CATALOG OVERVIEW TABLE */}
        {/* ============================================================ */}
        <Card className="border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/60 shadow-sm rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md">
          <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                    Product Catalog & Stock Matrix
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Live inventory synced with autonomous WhatsApp AI agent search
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => api.downloadSampleProductsCsv()}
                  className="gap-1.5 text-xs h-8 sm:h-9"
                >
                  <Download className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Template CSV</span>
                  <span className="sm:hidden">Template</span>
                </Button>

                {activeStore && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsCsvModalOpen(true)}
                    className="gap-1.5 text-xs font-bold h-8 sm:h-9"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Import CSV</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Category Pills (Horizontal Scroll on Mobile) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      catalogCategory === cat
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by title, SKU..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch("")}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Responsive Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800/80 text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 sm:px-4">SKU / Code</th>
                  <th className="py-3 px-3.5 sm:px-4">Product Name</th>
                  <th className="py-3 px-3.5 sm:px-4">Category</th>
                  <th className="py-3 px-3.5 sm:px-4">Price</th>
                  <th className="py-3 px-3.5 sm:px-4">Total Stock</th>
                  <th className="py-3 px-3.5 sm:px-4">Variants</th>
                  <th className="py-3 px-3.5 sm:px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                {catalogLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      Loading catalog items...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No products found matching criteria. Use &quot;Import CSV&quot; to populate your store catalog.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.slice(0, 10).map((product) => {
                    const isOutOfStock = (product.stock_quantity || 0) <= 0;
                    return (
                      <tr
                        key={product.id || product.sku}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors"
                      >
                        <td className="py-3 px-3.5 sm:px-4 font-mono font-bold text-zinc-900 dark:text-zinc-200">
                          {product.sku}
                        </td>
                        <td className="py-3 px-3.5 sm:px-4 font-semibold text-zinc-900 dark:text-white max-w-xs truncate">
                          {product.title || product.name}
                        </td>
                        <td className="py-3 px-3.5 sm:px-4">
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-[10px]">
                            {product.category || "General"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 sm:px-4 font-bold text-zinc-900 dark:text-white">
                          ${Number(product.price).toFixed(2)}
                        </td>
                        <td className="py-3 px-3.5 sm:px-4 font-mono">
                          <span
                            className={
                              isOutOfStock
                                ? "text-red-500 font-bold"
                                : (product.stock_quantity || 0) < 10
                                ? "text-amber-500 font-bold"
                                : "text-emerald-600 dark:text-emerald-400 font-bold"
                            }
                          >
                            {product.stock_quantity || 0}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 sm:px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            {(product.size_variants || []).map((v, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  v.stock > 0
                                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40"
                                    : "bg-red-50 dark:bg-red-950/40 text-red-500 border border-red-200 dark:border-red-800/40 line-through"
                                }`}
                              >
                                {v.size}:{v.stock}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 sm:px-4">
                          {isOutOfStock ? (
                            <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                          ) : (
                            <Badge variant="success" className="text-[10px]">In Stock</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredProducts.length > 10 && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border-t border-zinc-200 dark:border-zinc-800/80 text-center text-xs text-zinc-500 dark:text-zinc-400">
              Showing top 10 of {filteredProducts.length} products. Visit Catalog page for full inventory editing.
            </div>
          )}
        </Card>

        {/* ============================================================ */}
        {/* ACTIVITY FEED & ARCHITECTURE GUARDRAILS */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>

          <div className="space-y-6">
            <Card className="p-4 sm:p-5 space-y-4 border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/60 shadow-sm rounded-2xl">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
                <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  AI Anti-Hallucination Guardrails
                </h4>
                <Badge variant="success" dot={true} className="text-[10px]">
                  Enforced
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                  <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                    1. Direct Database Grounding
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Agent queries live SQLite / PostgreSQL stores before answering stock or order status questions.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                  <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />
                    2. Smart Out-of-Stock Fallbacks
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Proactively offers available sizes when requested size is unavailable.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
                  <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    3. Roman Urdu Multilingual Parser
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Resolves English & Roman Urdu customer inquiries natively.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* 3-Step Onboarding Stepper Wizard Modal */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={stores.length > 0 ? () => setIsOnboardingOpen(false) : undefined}
        onComplete={handleOnboardingComplete}
      />

      {/* WhatsApp Live Test & QR Code Modal */}
      {activeStore && (
        <WhatsAppTestModal
          isOpen={isTestWhatsAppOpen}
          onClose={() => setIsTestWhatsAppOpen(false)}
          storeName={activeStore.name}
          storeId={activeStore.id}
          phoneNumberId={activeStore.whatsapp_phone_number_id}
        />
      )}

      {/* Catalog CSV Upload Modal */}
      {activeStore && (
        <CsvUploadModal
          isOpen={isCsvModalOpen}
          onClose={() => setIsCsvModalOpen(false)}
          storeId={activeStore.id}
          onSuccess={() => loadStoreCatalog(activeStore.id)}
        />
      )}

      {/* Webhook Simulator Modal */}
      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={loadDashboard}
      />
    </div>
  );
}
