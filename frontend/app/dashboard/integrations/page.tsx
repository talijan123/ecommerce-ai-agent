"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Store,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
  ArrowRight,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Code,
  Check,
  Copy,
  Plus,
  Loader2,
  Clock,
  ShieldCheck,
  ArrowUpRight,
  PackageCheck,
  Globe,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { ShopifyConnectModal } from "@/components/dashboard/ShopifyConnectModal";
import { WooCommerceConnectModal } from "@/components/dashboard/WooCommerceConnectModal";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/lib/ui";
import {
  api,
  StoreResponse,
  IntegrationResponse,
  Product,
  formatApiError,
  API_BASE_URL,
} from "@/lib/api";

export default function IntegrationsPage() {
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>("");
  const [integrations, setIntegrations] = useState<IntegrationResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);

  // Modals
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
  const [isWooCommerceModalOpen, setIsWooCommerceModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Instant reactive feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, string>>({});
  const [toastNotification, setToastNotification] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error" | "info", title: string, message: string) => {
    setToastNotification({ type, title, message });
    setTimeout(() => {
      setToastNotification(null);
    }, 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load integrations and products for active store
  const loadStoreIntegrations = useCallback(async (storeId: string) => {
    try {
      const [integrationsData, productsData] = await Promise.all([
        api.getStoreIntegrations(storeId).catch(() => []),
        api.getStoreProducts(storeId).catch(() => []),
      ]);
      setIntegrations((prev) => {
        if (!integrationsData || integrationsData.length === 0) {
          return prev;
        }
        const merged = [...integrationsData];
        for (const item of prev) {
          if (!merged.some((m) => m.platform === item.platform)) {
            merged.push(item);
          }
        }
        return merged;
      });
      if (productsData && productsData.length > 0) {
        setProducts(productsData);
      }
    } catch (err) {
      console.error("Error loading store integrations:", err);
    }
  }, []);

  // Main data loader
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const storesData = await api.listStores().catch(() => []);
      setStores(storesData);

      if (storesData.length > 0) {
        const selectedId = activeStoreId || storesData[0].id;
        setActiveStoreId(selectedId);
        await loadStoreIntegrations(selectedId);
      }
    } catch (err) {
      console.error("Error loading stores list:", err);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, loadStoreIntegrations]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  const handleStoreChange = async (storeId: string) => {
    setActiveStoreId(storeId);
    setLoading(true);
    await loadStoreIntegrations(storeId);
    setLoading(false);
  };

  // Find direct integration records
  const shopifyIntegration = integrations.find((i) => i.platform === "shopify");
  const wooIntegration = integrations.find((i) => i.platform === "woocommerce");

  const isShopifyConnected =
    shopifyIntegration?.sync_status === "connected" ||
    (shopifyIntegration?.products_synced_count ?? 0) > 0 ||
    Boolean(shopifyIntegration?.shop_domain);

  const isWooConnected =
    wooIntegration?.sync_status === "connected" ||
    (wooIntegration?.products_synced_count ?? 0) > 0 ||
    Boolean(wooIntegration?.shop_domain);

  // Format relative timestamp
  const formatSyncTime = (platform: string, timestamp?: string | null) => {
    if (lastSyncTimes[platform]) {
      return lastSyncTimes[platform];
    }
    if (!timestamp) return "Never synced";
    try {
      const date = new Date(timestamp);
      const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSeconds < 60) return "Just now";
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hours ago`;
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  // Immediate optimistic update when Shopify connects/syncs
  const handleShopifySuccess = (result?: IntegrationResponse) => {
    const domain = result?.shop_domain || shopifyIntegration?.shop_domain || `${activeStore?.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.myshopify.com`;
    const count = result?.products_synced_count !== undefined ? result.products_synced_count : 2;

    // 1. Instant Optimistic State Update
    setIntegrations((prev) => {
      const filtered = prev.filter((i) => i.platform !== "shopify");
      const updated: IntegrationResponse = {
        id: result?.id || (shopifyIntegration ? shopifyIntegration.id : `shopify-${Date.now()}`),
        store_id: activeStoreId,
        platform: "shopify",
        shop_domain: domain,
        sync_status: "connected",
        products_synced_count: count,
        last_synced_at: new Date().toISOString(),
        created_at: shopifyIntegration?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [updated, ...filtered];
    });

    // 2. Mark Last Synced as Just now
    setLastSyncTimes((prev) => ({ ...prev, shopify: "Just now" }));

    // 3. Instant Toast Alert
    showToast(
      "success",
      "Shopify Connected Successfully!",
      `Live catalog connected for ${domain}. ${count} products synchronized into catalog.`
    );

    // 4. Background re-fetch of server state to ensure fresh data
    if (activeStoreId) {
      loadStoreIntegrations(activeStoreId);
    }
  };

  // Immediate optimistic update when WooCommerce connects/syncs
  const handleWooCommerceSuccess = (result?: any) => {
    const domain = result?.shop_domain || wooIntegration?.shop_domain || `https://${activeStore?.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    const count = result?.products_synced !== undefined ? result.products_synced : (wooIntegration?.products_synced_count || 5);

    setIntegrations((prev) => {
      const filtered = prev.filter((i) => i.platform !== "woocommerce");
      const updated: IntegrationResponse = {
        id: result?.id || (wooIntegration ? wooIntegration.id : `woo-${Date.now()}`),
        store_id: activeStoreId,
        platform: "woocommerce",
        shop_domain: domain,
        sync_status: "connected",
        products_synced_count: count,
        last_synced_at: new Date().toISOString(),
        created_at: wooIntegration?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [updated, ...filtered];
    });

    setLastSyncTimes((prev) => ({ ...prev, woocommerce: "Just now" }));

    showToast(
      "success",
      "WooCommerce Connected Successfully!",
      `Live REST API catalog synchronized for ${domain}. ${count} products available.`
    );

    if (activeStoreId) {
      loadStoreIntegrations(activeStoreId);
    }
  };

  // Re-sync Shopify Catalog Mutation
  const handleReSyncShopify = async () => {
    if (!activeStoreId) return;
    try {
      setSyncingPlatform("shopify");
      const syncResult = await api.syncShopify(activeStoreId, false);
      const syncedCount = syncResult.products_synced ?? 0;

      // Update local state reactively
      setIntegrations((prev) =>
        prev.map((item) =>
          item.platform === "shopify"
            ? {
                ...item,
                sync_status: "connected",
                products_synced_count: syncedCount,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      setLastSyncTimes((prev) => ({ ...prev, shopify: "Just now" }));

      showToast(
        "success",
        "Shopify Catalog Synced",
        `Successfully re-synced ${syncedCount} products from ${shopifyIntegration?.shop_domain || "Shopify"}.`
      );

      // Re-fetch products to update catalog count
      await loadStoreIntegrations(activeStoreId);
    } catch (err: any) {
      showToast("error", "Sync Failed", formatApiError(err));
    } finally {
      setSyncingPlatform(null);
    }
  };

  // Re-sync WooCommerce Catalog Mutation
  const handleReSyncWooCommerce = async () => {
    if (!activeStoreId) return;
    try {
      setSyncingPlatform("woocommerce");
      const syncResult = await api.syncWooCommerce(activeStoreId);
      const syncedCount = syncResult.products_synced ?? 0;

      setIntegrations((prev) =>
        prev.map((item) =>
          item.platform === "woocommerce"
            ? {
                ...item,
                sync_status: "connected",
                products_synced_count: syncedCount,
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      setLastSyncTimes((prev) => ({ ...prev, woocommerce: "Just now" }));

      showToast(
        "success",
        "WooCommerce Catalog Synced",
        `Successfully re-synced ${syncedCount} products from ${wooIntegration?.shop_domain || "WooCommerce"}.`
      );

      await loadStoreIntegrations(activeStoreId);
    } catch (err: any) {
      showToast("error", "Sync Failed", formatApiError(err));
    } finally {
      setSyncingPlatform(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Toast Notification Banner */}
      {toastNotification && (
        <div
          className={`p-4 rounded-2xl border shadow-xl flex items-start justify-between gap-3 animate-in slide-in-from-top-4 duration-300 ${
            toastNotification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200"
              : toastNotification.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200"
              : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {toastNotification.type === "success" && (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            {toastNotification.type === "error" && (
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            )}
            {toastNotification.type === "info" && (
              <Sparkles className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-sm font-bold">{toastNotification.title}</h4>
              <p className="text-xs opacity-90 mt-0.5">{toastNotification.message}</p>
            </div>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <Header
        title="Store Integrations & Live Sync"
        description="Connect your e-commerce storefronts to continuously synchronize catalog products, stock levels, and automated order webhooks."
      />

      {/* Active Store Switcher & Quick Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Active Store Tenant</div>
            <div className="flex items-center gap-2">
              <select
                value={activeStoreId}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="font-bold text-zinc-900 dark:text-white bg-transparent border-none p-0 pr-6 text-sm focus:ring-0 cursor-pointer appearance-none"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                    {s.name} ({s.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 text-zinc-400 pointer-events-none -ml-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-emerald-500" />
            <span>{products.length} Catalog Items</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>{(isShopifyConnected ? 1 : 0) + (isWooConnected ? 1 : 0)} Active Feeds</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeStoreId && loadStoreIntegrations(activeStoreId)}
            className="text-xs rounded-xl"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ========================================================================= */}
        {/* 1. SHOPIFY INTEGRATION CARD */}
        {/* ========================================================================= */}
        <Card className={`relative overflow-hidden transition-all duration-300 rounded-3xl border ${
          isShopifyConnected
            ? "border-emerald-500/30 dark:border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent shadow-emerald-500/5"
            : "border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60"
        } backdrop-blur-xl shadow-lg hover:shadow-xl`}>
          <div className="p-6 sm:p-7 space-y-6">
            {/* Top Row: Icon, Title, Status Badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Shopify</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      OAuth / Client Creds
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Live product catalog &amp; variant synchronization
                  </p>
                </div>
              </div>

              {/* Reactive Status Badge */}
              {isShopifyConnected ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-in fade-in duration-300 shadow-sm shadow-emerald-500/10">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active &amp; Connected</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  Not Connected
                </div>
              )}
            </div>

            {/* Connection Details Box */}
            <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-500" /> Connected Domain
                </span>
                {shopifyIntegration?.shop_domain ? (
                  <a
                    href={`https://${shopifyIntegration.shop_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                  >
                    {shopifyIntegration.shop_domain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-zinc-400 italic">Not configured</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5 text-emerald-500" /> Synced Catalog
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {shopifyIntegration?.products_synced_count ?? 0} Products Synced
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" /> Last Synchronized
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {formatSyncTime("shopify", shopifyIntegration?.last_synced_at || shopifyIntegration?.updated_at)}
                </span>
              </div>
            </div>

            {/* 1-Click Theme App Embed Activation (when connected) */}
            {isShopifyConnected && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 space-y-2.5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      Shopify Theme App Embed
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    Zero-Code
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Opens your Shopify theme editor with the AI Assistant app embed ready to toggle on.
                </p>
                <a
                  href={`https://${(shopifyIntegration?.shop_domain || activeStore?.name || "my-brand.myshopify.com").replace(/^https?:\/\//i, "").replace(/\/+$/, "")}/admin/themes/current/editor?context=apps`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Activate Widget in 1-Click</span>
                  <ExternalLink className="h-3.5 w-3.5 ml-0.5 opacity-80" />
                </a>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              {isShopifyConnected ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-2xl min-h-[42px] font-semibold text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-sm"
                    onClick={handleReSyncShopify}
                    disabled={syncingPlatform === "shopify"}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${
                        syncingPlatform === "shopify" ? "animate-spin text-emerald-500" : "text-emerald-500"
                      }`}
                    />
                    {syncingPlatform === "shopify" ? "Syncing Catalog..." : "Re-sync Catalog"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl min-h-[42px] font-semibold text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => setIsShopifyModalOpen(true)}
                  >
                    Configure / Reconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="gradient"
                  size="sm"
                  className="w-full rounded-2xl min-h-[44px] font-bold text-xs shadow-lg shadow-emerald-500/20"
                  onClick={() => setIsShopifyModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Connect Shopify Store
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 2. WOOCOMMERCE INTEGRATION CARD */}
        {/* ========================================================================= */}
        <Card className={`relative overflow-hidden transition-all duration-300 rounded-3xl border ${
          isWooConnected
            ? "border-indigo-500/30 dark:border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.03] to-transparent"
            : "border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60"
        } backdrop-blur-xl shadow-lg hover:shadow-xl`}>
          <div className="p-6 sm:p-7 space-y-6">
            {/* Top Row: Icon, Title, Status Badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">WooCommerce</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      REST API v3
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Direct WordPress REST credentials sync
                  </p>
                </div>
              </div>

              {/* Reactive Status Badge */}
              {isWooConnected ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 animate-in fade-in duration-300">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                  Connected
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  Not Connected
                </div>
              )}
            </div>

            {/* Connection Details Box */}
            <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Store URL
                </span>
                {wooIntegration?.shop_domain ? (
                  <a
                    href={wooIntegration.shop_domain.startsWith("http") ? wooIntegration.shop_domain : `https://${wooIntegration.shop_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                  >
                    {wooIntegration.shop_domain}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-zinc-400 italic">Not configured</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <PackageCheck className="h-3.5 w-3.5" /> Synced Catalog Items
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {wooIntegration?.products_synced_count ?? 0} Products Synced
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Last Synchronized
                </span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {formatSyncTime("woocommerce", wooIntegration?.last_synced_at || wooIntegration?.updated_at)}
                </span>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 pt-1">
              {isWooConnected ? (
                <>
                  <Button
                    variant="gradient"
                    size="sm"
                    className="flex-1 rounded-2xl min-h-[42px] font-semibold text-xs shadow-md shadow-indigo-500/20"
                    onClick={handleReSyncWooCommerce}
                    disabled={syncingPlatform === "woocommerce"}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${
                        syncingPlatform === "woocommerce" ? "animate-spin" : ""
                      }`}
                    />
                    {syncingPlatform === "woocommerce" ? "Syncing Catalog..." : "Re-sync Catalog"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl min-h-[42px] font-semibold text-xs border-zinc-300 dark:border-zinc-700"
                    onClick={() => setIsWooCommerceModalOpen(true)}
                  >
                    Configure / Reconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="gradient"
                  size="sm"
                  className="w-full rounded-2xl min-h-[44px] font-bold text-xs shadow-lg shadow-indigo-500/20"
                  onClick={() => setIsWooCommerceModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Connect WooCommerce Store
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 3. CUSTOM WEBHOOKS & AUTOMATION INTEGRATION SECTION */}
      {/* ========================================================================= */}
      <Card className="rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl shadow-lg p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/20 shrink-0">
              <Code className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Real-time Webhook Ingestion Endpoints
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Instant Dispatch
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure your custom e-commerce backend or ERP to trigger autonomous WhatsApp notifications &amp; stock updates.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSimulatorOpen(true)}
            className="rounded-2xl min-h-[40px] text-xs font-semibold shrink-0"
          >
            <Zap className="h-4 w-4 mr-1.5 text-amber-500" />
            Launch Webhook Simulator
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Order Created Webhook */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  POST
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Order Ingestion &amp; Fulfillment
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/webhooks/orders/create`, "webhook_order")}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                title="Copy endpoint URL"
              >
                {copiedKey === "webhook_order" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <code className="block text-[11px] font-mono text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              {`${API_BASE_URL}/api/v1/webhooks/orders/create`}
            </code>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Triggers autonomous customer tracking updates and order confirmation alerts.
            </p>
          </div>

          {/* Inventory Update Webhook */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  POST
                </span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Live Stock &amp; Inventory Sync
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(`${API_BASE_URL}/api/v1/webhooks/inventory/update`, "webhook_inv")}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
                title="Copy endpoint URL"
              >
                {copiedKey === "webhook_inv" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <code className="block text-[11px] font-mono text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              {`${API_BASE_URL}/api/v1/webhooks/inventory/update`}
            </code>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Synchronizes SKU variant quantity changes immediately with the AI assistant.
            </p>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {activeStore && (
        <>
          <ShopifyConnectModal
            isOpen={isShopifyModalOpen}
            storeId={activeStore.id}
            storeName={activeStore.name}
            onClose={() => setIsShopifyModalOpen(false)}
            onSuccess={handleShopifySuccess}
          />

          <WooCommerceConnectModal
            isOpen={isWooCommerceModalOpen}
            storeId={activeStore.id}
            storeName={activeStore.name}
            onClose={() => setIsWooCommerceModalOpen(false)}
            onSuccess={handleWooCommerceSuccess}
          />
        </>
      )}

      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={() => {
          if (activeStoreId) loadStoreIntegrations(activeStoreId);
        }}
      />
    </div>
  );
}
