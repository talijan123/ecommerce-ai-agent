"use client";

import React, { useState } from "react";
import {
  Store,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  ShoppingBag,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api, formatApiError } from "@/lib/api";

interface ShopifyConnectModalProps {
  isOpen: boolean;
  storeId: string;
  storeName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ShopifyConnectModal({
  isOpen,
  storeId,
  storeName,
  onClose,
  onSuccess,
}: ShopifyConnectModalProps) {
  const [shopDomain, setShopDomain] = useState(
    `${storeName.toLowerCase().replace(/[^a-z0-9]/g, "") || "my-brand"}.myshopify.com`
  );
  const [accessToken, setAccessToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    if (!shopDomain.trim()) {
      setErrorMsg("Please provide your Shopify store domain (e.g. brand.myshopify.com)");
      return;
    }

    try {
      setLoading(true);
      setSyncing(true);

      // 1. Connect Store Domain & verify token
      await api.connectShopify({
        store_id: storeId,
        shop_domain: shopDomain.trim(),
        access_token: accessToken.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      });

      // 2. Trigger instant product sync
      const syncRes = await api.syncShopify(storeId);

      const count = syncRes.products_synced ?? syncRes.sample_products?.length ?? 0;
      setSuccessInfo(
        `Successfully synced ${count} products from your Shopify store (${shopDomain.trim()})!`
      );

      // Trigger catalog reload
      onSuccess?.();

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Connect Shopify Store</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live REST API
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Direct catalog & inventory synchronization for {storeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleConnectAndSync} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successInfo}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Shopify Store Domain *
            </label>
            <input
              type="text"
              required
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="e.g. your-brand.myshopify.com"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <span className="text-[11px] text-zinc-400 block">
              Enter your `.myshopify.com` store URL.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Admin API Access Token</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">shpat_...</span>
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx (leave blank for demo sync)"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Step-by-Step Help Accordion */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="w-full p-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>How to get your Shopify Admin Access Token</span>
              </div>
              {showHelpGuide ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>

            {showHelpGuide && (
              <div className="p-3.5 pt-0 text-xs text-zinc-600 dark:text-zinc-400 space-y-2.5 border-t border-zinc-200 dark:border-zinc-800">
                <div className="space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Go to your <strong>Shopify Admin</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Apps and sales channels</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Click <strong>Develop apps</strong> (enable custom app development if prompted) and select <strong>Create an app</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Under <strong>Configuration</strong> &rarr; <strong>Admin API integration</strong>, enable <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">read_products</code> and <code className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">read_inventory</code> scopes.
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Click <strong>Install app</strong>, then copy the generated <strong>Admin API access token</strong> (starts with <code className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">shpat_</code>).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Instant Catalog Ingestion
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Connecting will automatically fetch your live product titles, descriptions, prices, SKU size variants, and inventory levels directly into the AI database.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[40px]"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white min-h-[40px] gap-2 shadow-lg shadow-emerald-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting &amp; Syncing products...</span>
                </>
              ) : (
                <>
                  <span>Connect &amp; Sync Catalog</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
