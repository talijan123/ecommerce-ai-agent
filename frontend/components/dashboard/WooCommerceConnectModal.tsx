"use client";

import React, { useState } from "react";
import {
  Store,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api, formatApiError } from "@/lib/api";

interface WooCommerceConnectModalProps {
  isOpen: boolean;
  storeId: string;
  storeName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WooCommerceConnectModal({
  isOpen,
  storeId,
  storeName,
  onClose,
  onSuccess,
}: WooCommerceConnectModalProps) {
  const [shopDomain, setShopDomain] = useState(`https://${storeName.toLowerCase().replace(/[^a-z0-9]/g, "") || "mystore"}.com`);
  const [consumerKey, setConsumerKey] = useState("ck_live_merchant_12345678");
  const [consumerSecret, setConsumerSecret] = useState("cs_live_merchant_87654321");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    if (!shopDomain.trim()) {
      setErrorMsg("Please provide your WooCommerce store URL");
      return;
    }

    try {
      setLoading(true);
      await api.connectWooCommerce({
        store_id: storeId,
        shop_domain: shopDomain.trim(),
        consumer_key: consumerKey.trim() || undefined,
        consumer_secret: consumerSecret.trim() || undefined,
      });

      setSyncing(true);
      const syncRes = await api.syncWooCommerce(storeId);

      setSuccessInfo(
        `Connected to ${shopDomain}! Successfully synchronized ${syncRes.products_synced} products into your active catalog.`
      );

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                Connect WooCommerce Store
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  REST API
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Direct catalog & inventory synchronization for {storeName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleConnectAndSync} className="p-6 space-y-4">
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
              WooCommerce Store URL *
            </label>
            <input
              type="text"
              required
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="e.g. https://your-store.com"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Consumer Key (ck_...)
              </label>
              <input
                type="password"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="ck_..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Consumer Secret (cs_...)
              </label>
              <input
                type="password"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="cs_..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-800 dark:text-indigo-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Automated Catalog Sync
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Sync products, pricing, categories, and inventory from your WordPress/WooCommerce installation.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={loading} className="min-h-[40px]">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white min-h-[40px] gap-2 shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {syncing ? "Synchronizing..." : "Connecting..."}
                </>
              ) : (
                <>
                  <span>Connect & Sync</span>
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
