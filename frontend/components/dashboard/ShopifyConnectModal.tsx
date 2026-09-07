"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api, formatApiError, IntegrationResponse } from "@/lib/api";

interface ShopifyConnectModalProps {
  isOpen: boolean;
  storeId: string;
  storeName: string;
  onClose: () => void;
  onSuccess?: (result?: IntegrationResponse) => void;
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    const cleanDomain = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

    if (!cleanDomain) {
      setErrorMsg("Please provide your Shopify store domain (e.g. your-store.myshopify.com)");
      return;
    }

    try {
      setLoading(true);

      // Connect Store Domain and ingest live catalog
      const result = await api.connectShopify({
        store_id: storeId,
        shop_domain: cleanDomain,
      });

      const count = result.products_synced_count ?? 0;
      setSuccessInfo(
        count > 0
          ? `Successfully connected and synced ${count} products from ${cleanDomain}!`
          : `Successfully connected ${cleanDomain}! Catalog synchronization is complete.`
      );

      // Trigger immediate callback with updated integration data
      onSuccess?.(result);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      const formatted = formatApiError(err);
      setErrorMsg(formatted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Connect Shopify Store
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  1-Click
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Live catalog synchronization for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{storeName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleConnectAndSync} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <div className="font-semibold">Connection Failed</div>
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successInfo}</span>
            </div>
          )}

          {/* Shop Domain Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Store Domain *</span>
              <span className="text-[10px] text-zinc-400 font-mono">.myshopify.com</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store-name.myshopify.com"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono transition-colors shadow-inner"
              />
            </div>
            <span className="text-[11px] text-zinc-400 block">
              Enter your myshopify domain (e.g. <code className="text-emerald-600 dark:text-emerald-400 font-semibold">yqcncc-b0.myshopify.com</code>).
            </span>
          </div>

          {/* Sync Information Callout */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Automatic Real-Time Catalog Sync
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Upon connection, our AI engine automatically imports your live product catalog, titles, descriptions, prices, SKU size variations, and stock levels.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[40px] rounded-xl px-4"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white min-h-[40px] px-5 rounded-xl gap-2 shadow-lg shadow-emerald-600/20 transition-all font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting &amp; Ingesting...</span>
                </>
              ) : (
                <>
                  <span>Connect &amp; Sync</span>
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
