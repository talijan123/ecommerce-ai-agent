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
  Eye,
  EyeOff,
  Copy,
  Check,
  Layers,
  Sparkles,
  Info,
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

type AuthMode = "oauth" | "legacy_token";

export function ShopifyConnectModal({
  isOpen,
  storeId,
  storeName,
  onClose,
  onSuccess,
}: ShopifyConnectModalProps) {
  const [authMode, setAuthMode] = useState<AuthMode>("oauth");
  const [shopDomain, setShopDomain] = useState(
    `${storeName.toLowerCase().replace(/[^a-z0-9]/g, "") || "my-brand"}.myshopify.com`
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnectAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    const cleanDomain = shopDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

    if (!cleanDomain) {
      setErrorMsg("Please provide your Shopify store domain (e.g. brand.myshopify.com)");
      return;
    }

    if (authMode === "oauth" && (!clientId.trim() || !clientSecret.trim())) {
      setErrorMsg("Please enter both your Shopify App Client ID and Client Secret.");
      return;
    }

    if (authMode === "legacy_token" && !accessToken.trim()) {
      setErrorMsg("Please enter your Shopify Admin API Access Token (shpat_...).");
      return;
    }

    try {
      setLoading(true);

      // 1. Connect Store Domain, exchange OAuth credentials or verify token, and ingest catalog
      const connectPayload = {
        store_id: storeId,
        shop_domain: cleanDomain,
        ...(authMode === "oauth"
          ? {
              client_id: clientId.trim(),
              client_secret: clientSecret.trim(),
            }
          : {
              access_token: accessToken.trim(),
            }),
      };

      const result = await api.connectShopify(connectPayload);

      const count = result.products_synced_count ?? 0;
      setSuccessInfo(
        count > 0
          ? `Successfully connected and synced ${count} products from ${cleanDomain}!`
          : `Successfully connected ${cleanDomain}! Catalog synchronization is in progress.`
      );

      // Trigger catalog reload
      onSuccess?.();

      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      const formatted = formatApiError(err);
      setErrorMsg(formatted);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
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
                  Client Credentials
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Direct live catalog &amp; inventory synchronization for <span className="font-semibold text-zinc-700 dark:text-zinc-300">{storeName}</span>
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
        <form onSubmit={handleConnectAndSync} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
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
              <span>Shopify Store Domain *</span>
              <span className="text-[10px] text-zinc-400 font-mono">.myshopify.com</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store-name.myshopify.com"
                className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono transition-colors"
              />
            </div>
            <span className="text-[11px] text-zinc-400 block">
              Enter your store's primary myshopify domain (e.g. <code className="text-emerald-600 dark:text-emerald-400">your-store-name.myshopify.com</code>).
            </span>
          </div>

          {/* Authentication Mode Selector Tabs */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
              <span>Authentication Method</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setAuthMode("oauth")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === "oauth"
                    ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Client ID &amp; Secret</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">
                  Modern
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuthMode("legacy_token")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  authMode === "legacy_token"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/80 dark:border-zinc-700/80"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Legacy Access Token</span>
              </button>
            </div>
          </div>

          {/* Mode 1: OAuth Client Credentials */}
          {authMode === "oauth" ? (
            <div className="space-y-3 p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Shopify App Client ID (API Key) *
                </label>
                <input
                  type="text"
                  required={authMode === "oauth"}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter your Shopify Client ID"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Shopify App Client Secret *
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    required={authMode === "oauth"}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Enter Client Secret (shpss_...)"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Legacy Access Token */
            <div className="space-y-1.5 p-4 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Admin API Access Token *</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">shpat_...</span>
              </label>
              <input
                type="password"
                required={authMode === "legacy_token"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter Admin API Token (shpat_...)"
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="text-[11px] text-zinc-400 block">
                Direct legacy custom app access token generated in Shopify Admin.
              </span>
            </div>
          )}

          {/* 2026 Modern Shopify Dev Setup Guide Accordion */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/30">
            <button
              type="button"
              onClick={() => setShowHelpGuide(!showHelpGuide)}
              className="w-full p-3.5 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Shopify Dev / Partner App Setup Guide (2026)</span>
              </div>
              {showHelpGuide ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>

            {showHelpGuide && (
              <div className="p-4 pt-1 text-xs text-zinc-600 dark:text-zinc-400 space-y-3 border-t border-zinc-200 dark:border-zinc-800">
                <div className="space-y-2.5 mt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Go to{" "}
                      <a
                        href="https://partners.shopify.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 font-semibold underline inline-flex items-center gap-0.5"
                      >
                        Shopify Partner / Dev Dashboard
                        <ExternalLink className="h-3 w-3" />
                      </a>{" "}
                      &rarr; <strong>Apps</strong> &rarr; Click <strong>Create an app</strong> (e.g. <em>AutoCommerce AI</em>).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="text-[11px] leading-relaxed space-y-1">
                      <p>Under <strong>App setup</strong> / <strong>URLs</strong>, configure:</p>
                      <div className="space-y-1 font-mono text-[10px] bg-white dark:bg-zinc-950 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span>App URL: <code className="text-zinc-800 dark:text-zinc-200">https://localhost:3000</code></span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("https://localhost:3000", "appUrl")}
                            className="text-zinc-400 hover:text-emerald-500 ml-2"
                          >
                            {copiedField === "appUrl" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Callback URL: <code className="text-zinc-800 dark:text-zinc-200">https://localhost:3000/api/auth/callback</code></span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard("https://localhost:3000/api/auth/callback", "callbackUrl")}
                            className="text-zinc-400 hover:text-emerald-500 ml-2"
                          >
                            {copiedField === "callbackUrl" ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Enable <strong>"Use legacy install flow: true"</strong> or configure direct app authorization.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <div className="text-[11px] leading-relaxed">
                      Under <strong>Admin API access scopes</strong>, select:
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">
                          read_products
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">
                          write_products
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px] text-zinc-800 dark:text-zinc-200">
                          read_inventory
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      5
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Click <strong>Select store</strong> &rarr; install the app on your target store (e.g. <code>yqcncc-b0.myshopify.com</code>).
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      6
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> from the App Credentials page and paste them above.
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                  <span>Exchanging Token &amp; Syncing...</span>
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
