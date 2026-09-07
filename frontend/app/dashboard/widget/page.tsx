"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Copy,
  Check,
  Code,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Bot,
  Sliders,
  Smartphone,
  Eye,
  RefreshCw,
  Palette,
  Terminal,
  Zap,
  ChevronDown,
  ShoppingBag,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import { api, StoreResponse } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChatWidget } from "@/components/chat/ChatWidget";

const THEME_COLORS = [
  { name: "Indigo Modern", hex: "#4f46e5" },
  { name: "Emerald Growth", hex: "#10b981" },
  { name: "Electric Blue", hex: "#2563eb" },
  { name: "Rose Velvet", hex: "#f43f5e" },
  { name: "Amber Warm", hex: "#f59e0b" },
  { name: "Cyan Tech", hex: "#06b6d4" },
  { name: "Midnight Dark", hex: "#18181b" },
];

export default function WidgetDashboardPage() {
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState("#4f46e5");
  const [position, setPosition] = useState<"right" | "left">("right");
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedWebhookShopify, setCopiedWebhookShopify] = useState(false);
  const [copiedWebhookWoo, setCopiedWebhookWoo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    async function loadStores() {
      try {
        setLoading(true);
        const res = await api.listStores();
        setStores(res);
        if (res.length > 0) {
          setActiveStoreId(res[0].id);
        }
      } catch (e) {
        console.error("Failed to load stores for widget dashboard:", e);
      } finally {
        setLoading(false);
      }
    }
    loadStores();
  }, []);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0];
  const origin = typeof window !== "undefined" ? window.location.origin : "https://autocommerce.ai";

  const scriptTag = `<script src="${origin}/widget.js" data-store-id="${activeStoreId || "STORE_UUID"}" data-theme-color="${selectedColor}" data-position="${position}" async></script>`;

  const shopifyWebhook = `${origin}/api/v1/webhooks/shopify/${activeStoreId || "STORE_UUID"}/checkouts`;
  const wooWebhook = `${origin}/api/v1/webhooks/woocommerce/${activeStoreId || "STORE_UUID"}/cart`;

  const handleCopy = (text: string, type: "script" | "shopify" | "woo") => {
    navigator.clipboard.writeText(text);
    if (type === "script") {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else if (type === "shopify") {
      setCopiedWebhookShopify(true);
      setTimeout(() => setCopiedWebhookShopify(false), 2000);
    } else {
      setCopiedWebhookWoo(true);
      setTimeout(() => setCopiedWebhookWoo(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Storefront Widget"
        description="Deploy and customize your autonomous storefront AI assistant"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
        {/* Page Title & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                Storefront Live Chat Widget
              </h2>
              <Badge variant="indigo" className="gap-1 text-[11px]">
                <Sparkles className="w-3 h-3" />
                Embeddable
              </Badge>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Deploy your autonomous AI assistant on any Shopify, WooCommerce, or custom storefront with a single line of code.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {stores.length > 1 && (
              <select
                value={activeStoreId}
                onChange={(e) => setActiveStoreId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <Link href={`/widget?store_id=${activeStoreId}`} target="_blank">
              <Button variant="secondary" size="sm" className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Full Preview</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Grid: Code Generator vs Live Visual Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Embed Code & Customizer (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1-Click Shopify Theme App Embed Card */}
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-zinc-900/60 to-zinc-900/90 shadow-xl overflow-hidden">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base text-white">Shopify 1-Click Theme Embed</CardTitle>
                        <Badge variant="emerald" className="text-[10px] uppercase font-bold py-0.5">
                          Zero-Code
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Opens your Shopify theme editor with the AI Assistant app embed ready to toggle on.
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://${(activeStore?.name || "my-brand").toLowerCase().replace(/[^a-z0-9]/g, "")}.myshopify.com/admin/themes/current/editor?context=apps`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all shrink-0 hover:scale-105 active:scale-95"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Activate in 1-Click</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                </div>
              </CardHeader>
            </Card>

            {/* 1-Line Embed Code Card */}
            <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 via-zinc-900/60 to-zinc-900/90 shadow-xl overflow-hidden">
              <CardHeader className="border-b border-zinc-800/80 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Code className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">Generic HTML / JavaScript Script Tag</CardTitle>
                      <p className="text-xs text-zinc-400">Paste before the closing &lt;/body&gt; tag on WooCommerce, Webflow, or custom HTML stores.</p>
                    </div>
                  </div>
                  <Button
                    variant={copiedScript ? "secondary" : "gradient"}
                    size="sm"
                    onClick={() => handleCopy(scriptTag, "script")}
                    className="gap-1.5 text-xs font-bold"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? "Copied!" : "Copy Code"}</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="relative group">
                  <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 text-indigo-300 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
                    {scriptTag}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* Widget Theme Customizer */}
            <Card className="border-zinc-800/80 bg-zinc-900/70 shadow-md">
              <CardHeader className="border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-zinc-400" />
                  <CardTitle className="text-sm text-zinc-200">Branding & Widget Styling</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                {/* Theme Colors */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Launcher & Accent Color</label>
                  <div className="flex flex-wrap gap-2.5">
                    {THEME_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setSelectedColor(c.hex)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                          selectedColor === c.hex
                            ? "border-white bg-zinc-800 text-white font-bold shadow-sm"
                            : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ backgroundColor: c.hex }} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position */}
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-2">Screen Position</label>
                  <div className="grid grid-cols-2 gap-3 max-w-xs">
                    <button
                      type="button"
                      onClick={() => setPosition("right")}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        position === "right"
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      Bottom Right (Standard)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosition("left")}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        position === "left"
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      Bottom Left
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collapsed Advanced / Developer Settings Accordion */}
            <Card className="border-zinc-800/80 bg-zinc-900/60 shadow-md overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-200">Advanced / Developer Settings</h3>
                    <p className="text-[11px] text-zinc-400">Copy these links into your Shopify / WooCommerce webhook settings</p>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
              </button>

              {showAdvanced && (
                <CardContent className="pt-2 pb-4 px-4 space-y-4 text-xs border-t border-zinc-800/80 animate-in fade-in duration-200">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-zinc-300">Shopify Abandoned Checkouts Webhook</span>
                      <button
                        onClick={() => handleCopy(shopifyWebhook, "shopify")}
                        className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 text-[11px]"
                      >
                        {copiedWebhookShopify ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedWebhookShopify ? "Copied" : "Copy URL"}</span>
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono text-[11px] overflow-x-auto">
                      {shopifyWebhook}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-zinc-300">WooCommerce Cart Webhook</span>
                      <button
                        onClick={() => handleCopy(wooWebhook, "woo")}
                        className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 text-[11px]"
                      >
                        {copiedWebhookWoo ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedWebhookWoo ? "Copied" : "Copy URL"}</span>
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono text-[11px] overflow-x-auto">
                      {wooWebhook}
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Right Column: Live Simulated Storefront Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live Storefront Preview</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">Store: {activeStore?.name || "AutoCommerce"}</span>
            </div>

            {/* Simulated Browser Frame with strictly fixed height */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl flex flex-col h-[580px]">
              {/* Browser Window Chrome */}
              <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <div className="px-3 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 font-mono truncate max-w-[220px]">
                  https://{activeStore?.name.toLowerCase().replace(/\s+/g, "") || "store"}.myshopify.com
                </div>
                <div className="w-6" />
              </div>

              {/* Interactive Store Preview Frame */}
              <div className="flex-1 min-h-0 bg-zinc-950 p-2 sm:p-3 flex flex-col overflow-hidden">
                <ChatWidget standalone={true} storeId={activeStoreId} themeColor={selectedColor} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
