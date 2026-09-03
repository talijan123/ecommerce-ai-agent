"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  Package,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Tag,
  RotateCcw,
  Sparkles,
  Phone,
  Eye,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api } from "@/lib/api";

interface WebhookSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEMO_CARTS: Record<
  string,
  {
    name: string;
    phone: string;
    code: string;
    pct: number;
    items: string;
    url: string;
  }
> = {
  sess_live_wa_verify_001: {
    name: "Talal Test",
    phone: "923187806306",
    code: "RECOVER15",
    pct: 15,
    items: "Minimalist Ceramic Lamp (Size Standard)",
    url: "https://ecommerce-store-frontend-swart.vercel.app?cart_session=sess_live_wa_verify_001&discount=RECOVER15",
  },
  sess_abc123: {
    name: "Sarah Smith",
    phone: "923187806306",
    code: "SAVE15",
    pct: 15,
    items: "Essence Mascara Lash Princess (Size 30ml)",
    url: "https://ecommerce-store-frontend-swart.vercel.app?cart_session=sess_abc123&discount=SAVE15",
  },
  sess_xyz789: {
    name: "Ali Khan",
    phone: "923187806306",
    code: "RECOVER10",
    pct: 10,
    items: "Powder Canister (Size Standard)",
    url: "https://ecommerce-store-frontend-swart.vercel.app?cart_session=sess_xyz789&discount=RECOVER10",
  },
};

export function WebhookSimulator({ isOpen, onClose, onSuccess }: WebhookSimulatorProps) {
  const [activeTab, setActiveTab] = useState<"order" | "inventory" | "recovery">("order");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Order webhook mock form
  const [orderNumber, setOrderNumber] = useState("");
  const [customerEmail, setCustomerEmail] = useState("john.customer@example.com");
  const [customerName, setCustomerName] = useState("John Customer");
  const [carrier, setCarrier] = useState("DHL Express");

  // Inventory webhook mock form
  const [sku, setSku] = useState("BEA-ESS-ESS-001");
  const [size, setSize] = useState("30ml");
  const [availableStock, setAvailableStock] = useState("50");

  // WhatsApp Cart Recovery mock form
  const [recoverySession, setRecoverySession] = useState<string>("all");
  const [includeAlreadySent, setIncludeAlreadySent] = useState<boolean>(true);

  // Helper to reset all state
  const resetAllState = () => {
    setResult(null);
    setLoading(false);
    setOrderNumber(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
    setCustomerEmail("john.customer@example.com");
    setCustomerName("John Customer");
    setCarrier("DHL Express");
    setSku("BEA-ESS-ESS-001");
    setSize("30ml");
    setAvailableStock("50");
    setRecoverySession("all");
    setIncludeAlreadySent(true);
  };

  // Reset states whenever modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      resetAllState();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetAllState();
    onClose();
  };

  const handleResetLogs = () => {
    setResult(null);
  };

  const handleSessionChange = (newSession: string) => {
    setRecoverySession(newSession);
    setResult(null); // Clear previous dispatch results immediately on selection switch
  };

  if (!isOpen) return null;

  async function handleSendOrderWebhook() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.simulateOrderWebhook({
        order_number: orderNumber,
        email: customerEmail,
        customer_name: customerName,
        fulfillment_status: "fulfilled",
        carrier: carrier,
        tracking_number: `TRK-SIM-${Math.floor(100000 + Math.random() * 900000)}`,
        total_price: 74.99,
        line_items: [
          { title: "Essence Mascara Lash Princess", size: "30ml", quantity: 1, price: 9.99 },
          { title: "Eyeshadow Palette with Mirror", size: "30ml", quantity: 1, price: 19.99 },
        ],
      });
      setResult({ success: true, data: res });
      onSuccess?.();
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInventoryWebhook() {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.simulateInventoryWebhook(sku, parseInt(availableStock, 10), size);
      setResult({ success: true, data: res });
      onSuccess?.();
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerWhatsAppRecovery() {
    setLoading(true);
    setResult(null);
    try {
      const targetSession = recoverySession === "all" ? undefined : recoverySession;
      const res = await api.triggerWhatsAppCartRecovery(targetSession, includeAlreadySent);
      setResult({ success: true, data: res });
      onSuccess?.();
    } catch (e: any) {
      setResult({ success: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  const selectedCartPreview = recoverySession !== "all" ? DEMO_CARTS[recoverySession] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Constrained max-height dialog container to prevent off-screen expansion */}
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl text-zinc-900 dark:text-white overflow-hidden transition-colors">
        
        {/* Sticky Header with Title and Cancel/Close Button */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl gradient-blue-indigo text-white shadow-sm shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                E-Commerce Webhooks & WhatsApp Simulator
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Trigger Shopify/ERP events & automated WhatsApp recovery
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0 ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Tab Selection */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => {
                setActiveTab("order");
                setResult(null);
              }}
              className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === "order"
                  ? "bg-blue-600 text-white shadow"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              📦 Order Ingestion
            </button>
            <button
              onClick={() => {
                setActiveTab("inventory");
                setResult(null);
              }}
              className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === "inventory"
                  ? "bg-blue-600 text-white shadow"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              🔄 Stock Sync
            </button>
            <button
              onClick={() => {
                setActiveTab("recovery");
                setResult(null);
              }}
              className={`py-2 text-[11px] font-semibold rounded-lg transition-all ${
                activeTab === "recovery"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              💬 WhatsApp Recovery
            </button>
          </div>

          {/* Tab 1: Order Webhook */}
          {activeTab === "order" ? (
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                  Simulated Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                  Carrier Service
                </label>
                <input
                  type="text"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : activeTab === "inventory" ? (
            /* Tab 2: Inventory Stock Sync */
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                  Product SKU
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. BEA-ESS-ESS-001"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                    Variant Size
                  </label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. 30ml, 50ml, L"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                    New Available Stock
                  </label>
                  <input
                    type="number"
                    value={availableStock}
                    onChange={(e) => setAvailableStock(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Tab 3: WhatsApp Cart Recovery */
            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">
                  Target Abandoned Cart Session
                </label>
                <select
                  value={recoverySession}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">⚡ All Unrecovered Abandoned Carts (Batch Dispatch)</option>
                  <option value="sess_live_wa_verify_001">
                    Talal Test (sess_live_wa_verify_001) - 923187806306 [RECOVER15 / 15% off]
                  </option>
                  <option value="sess_abc123">
                    Sarah Smith (sess_abc123) - 923187806306 [SAVE15 / 15% off]
                  </option>
                  <option value="sess_xyz789">
                    Ali Khan (sess_xyz789) - 923187806306 [RECOVER10 / 10% off]
                  </option>
                </select>
              </div>

              {/* Dynamic Live Message Preview Bubble */}
              {selectedCartPreview ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-zinc-800 dark:text-zinc-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      <span>Live WhatsApp Template Preview</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20">
                      To: {selectedCartPreview.phone}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 font-sans whitespace-pre-line shadow-xs">
                    {`Hi ${selectedCartPreview.name}! 👋\n\nWe noticed you left ${selectedCartPreview.items} in your cart at AutoCommerce.\n\n🎁 Complete your order today with code *${selectedCartPreview.code}* for *${selectedCartPreview.pct}% off*!\n\n👉 Finish your checkout here: ${selectedCartPreview.url}`}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Tag className="h-3.5 w-3.5" />
                    <span>Automated Meta WhatsApp Recovery Flow</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                    Batch evaluates all eligible unrecovered cart sessions in Supabase, dynamically applies personalized discount codes, and sends outbound recovery WhatsApp messages via Meta Graph API.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none pt-1">
                <input
                  type="checkbox"
                  checked={includeAlreadySent}
                  onChange={(e) => setIncludeAlreadySent(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <span>Force re-dispatch if recovery was previously sent</span>
              </label>
            </div>
          )}

          {/* API Result / Message Payload Display (Constrained with internal scrolling) */}
          {result && (
            <div
              className={`p-3.5 rounded-2xl text-xs border space-y-2 max-h-52 overflow-y-auto ${
                result.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              }`}
            >
              {result.success ? (
                <>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>
                        {activeTab === "recovery"
                          ? `WhatsApp Cart Recovery Dispatched (${
                              result.data?.result?.total_dispatched ?? (result.data?.result?.status === "sent" ? 1 : 0)
                            } sent)`
                          : result.data?.message || "Webhook event processed successfully!"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20">
                      HTTP 200 OK
                    </span>
                  </div>

                  {result.data?.result?.dispatched_sessions && (
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-6">
                      {result.data.result.dispatched_sessions.map((s: any, idx: number) => (
                        <div key={idx}>
                          • <strong>{s.customer_name}</strong> ({s.customer_phone}): Code <code>{s.discount_code}</code> ({s.discount_percentage}% off)
                        </div>
                      ))}
                    </div>
                  )}

                  {result.data?.result?.message && (
                    <pre className="mt-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {result.data.result.message}
                    </pre>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Error: {result.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer with Clear / Reset, Close, and Dispatch Controls */}
        <div className="sticky bottom-0 z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div>
            {result ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetLogs}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear / Reset
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant={activeTab === "recovery" ? "primary" : "gradient"}
              size="sm"
              isLoading={loading}
              onClick={
                activeTab === "order"
                  ? handleSendOrderWebhook
                  : activeTab === "inventory"
                  ? handleSendInventoryWebhook
                  : handleTriggerWhatsAppRecovery
              }
              className={
                activeTab === "recovery"
                  ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white"
                  : ""
              }
            >
              {activeTab === "recovery" ? (
                <>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Dispatch WhatsApp Recovery
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Dispatch Webhook
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
