"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
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
  ShoppingBag,
  LifeBuoy,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { WhatsAppTestModal } from "@/components/dashboard/WhatsAppTestModal";
import { CsvUploadModal } from "@/components/dashboard/CsvUploadModal";
import { ShopifyConnectModal } from "@/components/dashboard/ShopifyConnectModal";
import { WooCommerceConnectModal } from "@/components/dashboard/WooCommerceConnectModal";
import { SupportTicketModal } from "@/components/dashboard/SupportTicketModal";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import {
  api,
  StoreResponse,
  Product,
  DashboardStats,
  Order,
  getSandboxConnectUrl,
  DEFAULT_WHATSAPP_CLEAN_PHONE,
} from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getProductImage } from "@/lib/productImages";

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
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
  const [isWooCommerceModalOpen, setIsWooCommerceModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Catalog Table Search & Filter
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("All");

  // Load catalog strictly for the selected tenant store
  const loadStoreCatalog = useCallback(async (storeId: string) => {
    try {
      setCatalogLoading(true);
      const storeProducts = await api.getStoreProducts(storeId).catch(() => []);
      // Strictly set tenant's actual products (no fallback to global dummy records)
      setProducts(storeProducts);
    } catch (err) {
      console.error("Error loading store products:", err);
      setProducts([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

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
  }, [activeStoreId, loadStoreCatalog]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  const handleStoreChange = (storeId: string) => {
    setActiveStoreId(storeId);
    loadStoreCatalog(storeId);
  };

  // Derive unique categories from tenant's real catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [products]);

  // Filtered products strictly for this tenant
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !catalogSearch ||
        p.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(catalogSearch.toLowerCase());
      const matchCat = catalogCategory === "All" || p.category === catalogCategory;
      return matchSearch && matchCat;
    });
  }, [products, catalogSearch, catalogCategory]);

  // Real KPI Metrics derived strictly from tenant data
  const totalProductsCount = products.length;
  const activeSessionsCount = stats?.total_conversations || 0;
  const totalOrdersCount = orders.length;
  const lowStockCount = products.filter(
    (p) => p.stock_quantity <= 5 || (p.size_variants || []).some((v) => v.stock === 0)
  ).length;

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="Merchant Control Center"
        description="Autonomous customer support, direct store integrations, catalog matrix, and WhatsApp sandbox operations."
        onRefresh={loadDashboard}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenWhatsAppTest={() => setIsTestWhatsAppOpen(true)}
        onOpenSupportTicket={() => setIsSupportModalOpen(true)}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 flex-1">
        {/* Top Tenant Bar: Store Selector, Sandbox Link & Quick Actions */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl md:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 shadow-sm">
          {/* Left: Active Store Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
              <Store className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                  {activeStore ? activeStore.name : "Loading Store..."}
                </span>

                <Badge variant="success" dot={true} className="text-[10px] py-0.5 px-2 font-mono">
                  WhatsApp Sandbox Active
                </Badge>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Owner: <span className="font-medium text-zinc-700 dark:text-zinc-300">{user?.email || activeStore?.owner_email}</span>
              </p>
            </div>
          </div>

          {/* Right: Store Switcher & Direct Ingestion Actions */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Store Switcher Dropdown */}
            {stores.length > 1 && (
              <div className="relative">
                <select
                  value={activeStoreId || ""}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test on WhatsApp Modal Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTestWhatsAppOpen(true)}
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 min-h-[38px] font-bold"
            >
              <Smartphone className="h-4 w-4" />
              <span>Test Bot</span>
            </Button>

            {/* Ingestion Trigger: CSV Upload */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCsvModalOpen(true)}
              className="gap-1.5 text-xs min-h-[38px]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload CSV</span>
            </Button>

            {/* Connect Shopify Direct Action */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsShopifyModalOpen(true)}
              className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 min-h-[38px] font-bold"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Shopify Sync</span>
            </Button>
          </div>
        </div>

        {/* 4-Card Responsive KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricsCard
            title="Total Catalog Products"
            value={totalProductsCount.toString()}
            icon={Package}
            trend={{ value: `${totalProductsCount} in database`, isPositive: true }}
            accentColor="blue"
          />
          <MetricsCard
            title="Active WhatsApp Sessions"
            value={activeSessionsCount.toString()}
            icon={MessageSquare}
            trend={{ value: "Multi-turn sandbox", isPositive: true }}
            accentColor="emerald"
          />
          <MetricsCard
            title="Customer Inquiries"
            value={stats?.total_messages?.toString() || "0"}
            icon={Bot}
            trend={{ value: "Autonomous AI AI replies", isPositive: true }}
            accentColor="indigo"
          />
          <MetricsCard
            title="Low Stock & Variant Alerts"
            value={lowStockCount.toString()}
            icon={AlertTriangle}
            trend={{ value: lowStockCount === 0 ? "Inventory healthy" : "Restock recommended", isPositive: lowStockCount === 0 }}
            accentColor="amber"
          />
        </div>

        {/* Catalog Section: Empty State OR Live Product Table */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Store Catalog & Variant Stock
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Products queried in real-time by the AI agent during WhatsApp conversations
              </p>
            </div>

            {totalProductsCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {/* Search Bar */}
                <div className="relative flex-1 sm:w-64">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search titles, SKUs..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch("")}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="gap-1.5 text-xs min-h-[38px] shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Add Products
                </Button>
              </div>
            )}
          </div>

          {/* Condition 1: Tenant has 0 Products -> Render Clean Empty State */}
          {totalProductsCount === 0 && !catalogLoading ? (
            <Card className="p-8 sm:p-12 text-center rounded-3xl border-dashed border-2 border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 shadow-sm">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-16 w-16 rounded-3xl gradient-blue-indigo flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-500/20">
                  <Package className="h-8 w-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    No Products In Catalog Yet
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Your WhatsApp AI agent requires inventory to answer customer questions and recommend items. Connect your store or upload a CSV spreadsheet to start.
                  </p>
                </div>

                {/* 3 Primary Sync / Ingestion Actions */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setIsShopifyModalOpen(true)}
                    className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                  >
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold">Connect Shopify</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Direct 1-Click Sync</span>
                  </button>

                  <button
                    onClick={() => setIsWooCommerceModalOpen(true)}
                    className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                  >
                    <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Store className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold">WooCommerce</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">REST API Sync</span>
                  </button>

                  <button
                    onClick={() => setIsCsvModalOpen(true)}
                    className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-800 dark:text-blue-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                  >
                    <div className="h-10 w-10 rounded-xl gradient-blue-indigo text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold">Upload CSV</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Excel / Spreadsheet</span>
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            /* Condition 2: Tenant HAS Products -> Render Interactive Table */
            <Card className="p-0 overflow-hidden border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xl">
              {/* Category Pills Bar */}
              {categories.length > 1 && (
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCatalogCategory(cat)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                        catalogCategory === cat
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Responsive Table Container */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">SKU & Title</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Price</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Variants</th>
                      <th className="p-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                    {catalogLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                          Loading store catalog...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                          No products match your filter search.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const isLow = p.stock_quantity <= 5;
                        const img = getProductImage(p.sku, p.category, p.title, p.image_url);

                        return (
                          <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={img}
                                  alt={p.title}
                                  className="h-10 w-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                                />
                                <div>
                                  <div className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{p.title}</div>
                                  <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{p.sku}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                            </td>
                            <td className="p-4 font-black text-zinc-900 dark:text-white">{formatCurrency(p.price)}</td>
                            <td className="p-4 font-semibold text-zinc-700 dark:text-zinc-200">{p.stock_quantity} units</td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {(p.size_variants || []).map((v, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      v.stock > 0
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                        : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {v.size}:{v.stock}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              {p.stock_quantity === 0 ? (
                                <Badge variant="destructive" dot={true}>Out of Stock</Badge>
                              ) : isLow ? (
                                <Badge variant="warning" dot={true}>Low Stock</Badge>
                              ) : (
                                <Badge variant="success" dot={true}>In Stock</Badge>
                              )}
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
        </div>

        {/* Bottom Section: Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>

          <div className="space-y-4">
            {/* Quick Sandbox Help Card */}
            <Card className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-white">
                <Smartphone className="h-4 w-4 text-emerald-500" />
                <span>Instant WhatsApp Testing</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Connect your WhatsApp to test how the AI handles customer queries with this store's real catalog.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTestWhatsAppOpen(true)}
                className="w-full text-xs font-bold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 min-h-[38px]"
              >
                Open QR Pairing Modal
              </Button>
            </Card>

            {/* Need Help / Support Card */}
            <Card className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/60 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-white">
                <LifeBuoy className="h-4 w-4 text-blue-500" />
                <span>Need Support or Found a Bug?</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Submit an inquiry directly to platform engineering for prompt assistance.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsSupportModalOpen(true)}
                className="w-full text-xs min-h-[38px]"
              >
                Create Support Ticket
              </Button>
            </Card>
          </div>
        </div>
      </main>

      {/* Onboarding Stepper Modal */}
      {isOnboardingOpen && (
        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={() => {
            setIsOnboardingOpen(false);
            loadDashboard();
          }}
        />
      )}

      {/* WhatsApp Test & QR Code Modal */}
      {activeStore && (
        <WhatsAppTestModal
          isOpen={isTestWhatsAppOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsTestWhatsAppOpen(false)}
        />
      )}

      {/* CSV Upload Modal */}
      {activeStore && (
        <CsvUploadModal
          isOpen={isCsvModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsCsvModalOpen(false)}
          onSuccess={() => loadStoreCatalog(activeStore.id)}
        />
      )}

      {/* Shopify Connect Modal */}
      {activeStore && (
        <ShopifyConnectModal
          isOpen={isShopifyModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsShopifyModalOpen(false)}
          onSuccess={() => loadStoreCatalog(activeStore.id)}
        />
      )}

      {/* WooCommerce Connect Modal */}
      {activeStore && (
        <WooCommerceConnectModal
          isOpen={isWooCommerceModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsWooCommerceModalOpen(false)}
          onSuccess={() => loadStoreCatalog(activeStore.id)}
        />
      )}

      {/* Support Ticket Modal */}
      <SupportTicketModal
        isOpen={isSupportModalOpen}
        storeId={activeStore?.id || null}
        onClose={() => setIsSupportModalOpen(false)}
      />

      {/* Webhook Simulator Modal */}
      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={loadDashboard}
      />
    </div>
  );
}
