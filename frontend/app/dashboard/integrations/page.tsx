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
  Trash2,
  Unlink,
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
  const [shopifyDomainInput, setShopifyDomainInput] = useState<string>("");
  const [isConnectingShopify, setIsConnectingShopify] = useState<boolean>(false);
  const [isDisconnectingShopify, setIsDisconnectingShopify] = useState<boolean>(false);
  const [isClearingCatalog, setIsClearingCatalog] = useState<boolean>(false);

  // Reactive state for platform connections and store info
  const [shopifyConnected, setShopifyConnected] = useState<boolean>(false);
  const [shopifySyncStatus, setShopifySyncStatus] = useState<string>("disconnected");
  const [shopifyStoreInfo, setShopifyStoreInfo] = useState<{
    domain: string;
    productCount: number;
    lastSyncedAt?: string;
  } | null>(null);

  const [wooConnected, setWooConnected] = useState<boolean>(false);
  const [wooStoreInfo, setWooStoreInfo] = useState<{
    domain: string;
    productCount: number;
    lastSyncedAt?: string;
  } | null>(null);

  // Modals
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
  const [isWooCommerceModalOpen, setIsWooCommerceModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Instant reactive feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<string, string>>({});
  const [toastNotification, setToastNotification] = useState<{
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error" | "info" | "warning", title: string, message: string) => {
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

      if (Array.isArray(integrationsData)) {
        setIntegrations(integrationsData);

        // Sync Shopify reactive state
        const shopify = integrationsData.find((i) => i.platform === "shopify");
        if (
          shopify &&
          (shopify.sync_status === "connected" ||
            Boolean(shopify.shop_domain) ||
            (shopify.products_synced_count ?? 0) > 0)
        ) {
          setShopifyConnected(true);
          setShopifySyncStatus(shopify.sync_status || "connected");
          setShopifyStoreInfo({
            domain: shopify.shop_domain || "",
            productCount: shopify.products_synced_count ?? 0,
            lastSyncedAt: shopify.last_synced_at || shopify.updated_at || undefined,
          });
          if (shopify.shop_domain) {
            setShopifyDomainInput(shopify.shop_domain);
          }
        } else {
          setShopifyConnected(false);
          setShopifySyncStatus("disconnected");
          setShopifyStoreInfo(null);
        }

        // Sync WooCommerce reactive state
        const woo = integrationsData.find((i) => i.platform === "woocommerce");
        if (
          woo &&
          (woo.sync_status === "connected" ||
            Boolean(woo.shop_domain) ||
            (woo.products_synced_count ?? 0) > 0)
        ) {
          setWooConnected(true);
          setWooStoreInfo({
            domain: woo.shop_domain || "",
            productCount: woo.products_synced_count ?? 0,
            lastSyncedAt: woo.last_synced_at || woo.updated_at || undefined,
          });
        } else {
          setWooConnected(false);
          setWooStoreInfo(null);
        }
      }

      if (Array.isArray(productsData)) {
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
    shopifyConnected ||
    shopifySyncStatus === "connected" ||
    shopifyIntegration?.sync_status === "connected" ||
    (shopifyIntegration?.products_synced_count ?? 0) > 0 ||
    Boolean(shopifyIntegration?.shop_domain);

  const shopifyDomain =
    shopifyStoreInfo?.domain ||
    shopifyIntegration?.shop_domain ||
    shopifyDomainInput ||
    "";

  const syncedShopifyProductCount =
    shopifyStoreInfo?.productCount ??
    shopifyIntegration?.products_synced_count ??
    products.length;

  const isWooConnected =
    wooConnected ||
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
    const domain =
      result?.shop_domain ||
      shopifyDomainInput.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "") ||
      shopifyIntegration?.shop_domain ||
      "";
    const count =
      result?.products_synced_count !== undefined
        ? result.products_synced_count
        : (shopifyStoreInfo?.productCount ?? products.length ?? 2);

    // 1. Instant local reactive state updates
    setShopifyConnected(true);
    setShopifySyncStatus("connected");
    setShopifyStoreInfo({
      domain,
      productCount: count,
      lastSyncedAt: new Date().toISOString(),
    });
    setShopifyDomainInput(domain);

    // 2. Instant Optimistic State Update in integrations array
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

    // 3. Mark Last Synced as Just now
    setLastSyncTimes((prev) => ({ ...prev, shopify: "Just now" }));

    // 4. Instant Toast Alert
    showToast(
      "success",
      "Shopify Connected Successfully!",
      `Live catalog connected for ${domain}. ${count} products synchronized into catalog.`
    );

    // 5. Background re-fetch of server state to ensure fresh data
    if (activeStoreId) {
      loadStoreIntegrations(activeStoreId);
    }
  };

  // Direct single-input Shopify connection handler
  const handleDirectConnectShopify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeStoreId) return;

    const cleanDomain = shopifyDomainInput.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!cleanDomain) {
      showToast("error", "Domain Required", "Please enter your Shopify store domain (e.g. your-store.myshopify.com).");
      return;
    }

    try {
      setIsConnectingShopify(true);
      const result = await api.connectShopify({
        store_id: activeStoreId,
        shop_domain: cleanDomain,
      });

      // Immediate reactive local state updates
      setShopifyConnected(true);
      setShopifySyncStatus("connected");
      setShopifyStoreInfo({
        domain: result.shop_domain || cleanDomain,
        productCount: result.products_synced_count ?? 2,
        lastSyncedAt: new Date().toISOString(),
      });

      handleShopifySuccess(result);
    } catch (err: any) {
      showToast("error", "Connection Failed", formatApiError(err));
    } finally {
      setIsConnectingShopify(false);
    }
  };

  // Immediate optimistic update when WooCommerce connects/syncs
  const handleWooCommerceSuccess = (result?: any) => {
    const domain = result?.shop_domain || wooIntegration?.shop_domain || `https://${activeStore?.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    const count = result?.products_synced !== undefined ? result.products_synced : (wooIntegration?.products_synced_count || 5);

    setWooConnected(true);
    setWooStoreInfo({
      domain,
      productCount: count,
      lastSyncedAt: new Date().toISOString(),
    });

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
      const currentDomain = shopifyStoreInfo?.domain || shopifyIntegration?.shop_domain || shopifyDomainInput;

      // Update local state reactively immediately
      setShopifyConnected(true);
      setShopifySyncStatus("connected");
      setShopifyStoreInfo((prev) => ({
        domain: prev?.domain || currentDomain,
        productCount: syncedCount,
        lastSyncedAt: new Date().toISOString(),
      }));

      // Update integrations list reactively
      setIntegrations((prev) => {
        const existing = prev.find((i) => i.platform === "shopify");
        if (existing) {
          return prev.map((item) =>
            item.platform === "shopify"
              ? {
                  ...item,
                  sync_status: "connected",
                  products_synced_count: syncedCount,
                  last_synced_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : item
          );
        } else {
          return [
            {
              id: `shopify-${Date.now()}`,
              store_id: activeStoreId,
              platform: "shopify",
              shop_domain: currentDomain,
              sync_status: "connected",
              products_synced_count: syncedCount,
              last_synced_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            ...prev,
          ];
        }
      });

      setLastSyncTimes((prev) => ({ ...prev, shopify: "Just now" }));

      showToast(
        "success",
        "Shopify Catalog Synced",
        `Successfully re-synced ${syncedCount} products from ${currentDomain || "Shopify"}.`
      );

      // Re-fetch products & store integrations to update catalog count
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

      setWooConnected(true);
      setWooStoreInfo((prev) => ({
        domain: prev?.domain || wooIntegration?.shop_domain || "",
        productCount: syncedCount,
        lastSyncedAt: new Date().toISOString(),
      }));

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

  // Disconnect Shopify Integration Mutation
  const handleDisconnectShopify = async () => {
    if (!activeStoreId) return;

    const confirmed = window.confirm(
      "Are you sure you want to disconnect this store? Your AI assistant will stop serving storefront queries until reconnected."
    );
    if (!confirmed) return;

    try {
      setIsDisconnectingShopify(true);
      await api.disconnectShopify(activeStoreId);

      // Reset local state immediately
      setShopifyConnected(false);
      setShopifySyncStatus("disconnected");
      setShopifyStoreInfo(null);
      setIntegrations((prev) => prev.filter((i) => i.platform !== "shopify"));

      showToast(
        "success",
        "Shopify Disconnected",
        "Your Shopify store integration has been successfully disconnected."
      );

      await loadStoreIntegrations(activeStoreId);
    } catch (err: any) {
      showToast("error", "Disconnect Failed", formatApiError(err));
    } finally {
      setIsDisconnectingShopify(false);
    }
  };

  // Clear Store Catalog Mutation
  const handleClearCatalog = async () => {
    if (!activeStoreId) return;

    const confirmed = window.confirm(
      "Are you sure you want to wipe all catalog products for this store? This cannot be undone."
    );
    if (!confirmed) return;

    try {
      setIsClearingCatalog(true);
      const res = await api.clearStoreCatalog(activeStoreId);

      setProducts([]);
      setShopifyStoreInfo((prev) => (prev ? { ...prev, productCount: 0 } : null));

      showToast(
        "success",
        "Catalog Cleared",
        `Successfully removed ${res.deleted_count ?? 0} products from this store catalog.`
      );

      await loadStoreIntegrations(activeStoreId);
    } catch (err: any) {
      showToast("error", "Clear Catalog Failed", formatApiError(err));
    } finally {
      setIsClearingCatalog(false);
    }
  };

  // 1-Click Theme App Embed Activation Guard
  const handleActivateShopifyThemeEmbed = (e: React.MouseEvent) => {
    e.preventDefault();
    const domain = shopifyDomain || shopifyStoreInfo?.domain || shopifyIntegration?.shop_domain;
    if (!isShopifyConnected || !domain) {
      showToast(
        "warning",
        "Shopify Store Required",
        "Please connect your Shopify store first in the Integrations tab before activating the widget."
      );
      return;
    }
    const cleanDomain = domain.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    window.open(`https://${cleanDomain}/admin/themes/current/editor?context=apps`, "_blank", "noopener,noreferrer");
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
              : toastNotification.type === "warning"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
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
            {toastNotification.type === "warning" && (
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
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
          {products.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCatalog}
              disabled={isClearingCatalog || loading}
              className="text-xs rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors"
              title="Wipe all synced catalog items"
            >
              <Trash2 className={`h-3.5 w-3.5 mr-1.5 ${isClearingCatalog ? "animate-spin" : ""}`} />
              {isClearingCatalog ? "Clearing..." : "Clear Catalog"}
            </Button>
          )}
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
                      1-Click Connect
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Live product catalog &amp; variant synchronization
                  </p>
                </div>
              </div>

              {/* Reactive Status Badge & Product Count */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {isShopifyConnected ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-in fade-in duration-300 shadow-sm shadow-emerald-500/10">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>● Connected: {shopifyDomain}</span>
                    </div>
                    <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                      <PackageCheck className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{syncedShopifyProductCount} Synced</span>
                    </div>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    Not Connected
                  </div>
                )}
              </div>
            </div>

            {/* If NOT connected: Show single clean Domain Input & Connect Button */}
            {!isShopifyConnected ? (
              <form onSubmit={handleDirectConnectShopify} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <span>Store Domain *</span>
                    <span className="text-[10px] text-zinc-400 font-mono">.myshopify.com</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={shopifyDomainInput}
                      onChange={(e) => setShopifyDomainInput(e.target.value)}
                      placeholder="brand-name.myshopify.com"
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono transition-colors shadow-inner"
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block">
                    Enter your Shopify store domain (e.g. <code className="text-emerald-600 dark:text-emerald-400 font-semibold">brand-name.myshopify.com</code>).
                  </span>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="sm"
                  className="w-full rounded-2xl min-h-[46px] font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                  disabled={isConnectingShopify}
                >
                  {isConnectingShopify ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span>Connecting &amp; Ingesting Catalog...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      <span>Connect Shopify Store</span>
                    </>
                  )}
                </Button>
              </form>
            ) : (
              /* If CONNECTED: Show active enterprise status, 1-Click embed & re-sync button */
              <div className="space-y-6">
                {/* Connection Details Box */}
                <div className="p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-emerald-500" /> Connected Domain
                    </span>
                    {shopifyDomain ? (
                      <a
                        href={`https://${shopifyDomain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 hover:underline bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                      >
                        {shopifyDomain}
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
                      {syncedShopifyProductCount} Products Synced
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" /> Last Synchronized
                    </span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {formatSyncTime("shopify", shopifyStoreInfo?.lastSyncedAt || shopifyIntegration?.last_synced_at || shopifyIntegration?.updated_at)}
                    </span>
                  </div>
                </div>

                {/* 1-Click Theme App Embed Activation (when connected) */}
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
                  <button
                    type="button"
                    onClick={handleActivateShopifyThemeEmbed}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Activate Widget in 1-Click</span>
                    <ExternalLink className="h-3.5 w-3.5 ml-0.5 opacity-80" />
                  </button>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-2xl min-h-[42px] font-semibold text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 shadow-sm"
                    onClick={handleReSyncShopify}
                    disabled={syncingPlatform === "shopify" || isDisconnectingShopify}
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
                    disabled={isDisconnectingShopify}
                  >
                    Change Domain
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl min-h-[42px] font-semibold text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 shadow-sm transition-colors"
                    onClick={handleDisconnectShopify}
                    disabled={isDisconnectingShopify || syncingPlatform === "shopify"}
                  >
                    {isDisconnectingShopify ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        <span>Disconnecting...</span>
                      </>
                    ) : (
                      <>
                        <Unlink className="h-4 w-4 mr-1.5" />
                        <span>Disconnect Store</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 2. WOOCOMMERCE INTEGRATION CARD */}
        {/* ========================================================================= */}
        <Card className="relative overflow-hidden rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl shadow-lg opacity-90">
          <div className="p-6 sm:p-7 space-y-6">
            {/* Top Row: Icon, Title, Status Badge */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center shrink-0">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">WooCommerce</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Direct WordPress REST credentials sync
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                Coming Soon
              </div>
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/50 space-y-3 text-xs text-zinc-500 dark:text-zinc-400">
              <p className="leading-relaxed">
                Native WooCommerce plug-and-play synchronization is currently in private preview. Connect your live catalog via the active Shopify integration or custom Webhook ingestion endpoints.
              </p>
            </div>

            {/* Actions Bar */}
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-2xl min-h-[44px] font-semibold text-xs border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900/50"
                disabled
              >
                <Store className="h-4 w-4 mr-1.5 opacity-60" />
                WooCommerce Connector (Coming Soon)
              </Button>
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
