"use client";

import React, { useState } from "react";
import { X, Send, Package, RefreshCw, CheckCircle2, AlertCircle, MessageSquare, Tag, Phone } from "lucide-react";
import { Button, Card, CardTitle, Badge } from "@/lib/ui";
import { api } from "@/lib/api";

interface WebhookSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WebhookSimulator({ isOpen, onClose, onSuccess }: WebhookSimulatorProps) {
  const [activeTab, setActiveTab] = useState<"order" | "inventory" | "recovery">("order");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Order webhook mock form
  const [orderNumber, setOrderNumber] = useState(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customerEmail, setCustomerEmail] = useState("john.customer@example.com");
  const [customerName, setCustomerName] = useState("John Customer");
  const [carrier, setCarrier] = useState("DHL Express");

  // Inventory webhook mock form
  const [sku, setSku] = useState("BEA-ESS-ESS-001");
  const [size, setSize] = useState("30ml");
  const [availableStock, setAvailableStock] = useState("50");

  // WhatsApp Cart Recovery mock form
  const [recoverySession, setRecoverySession] = useState<string>("all");
  const [recoveryPhone, setRecoveryPhone] = useState<string>("+14155552671");
  const [includeAlreadySent, setIncludeAlreadySent] = useState<boolean>(true);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-white transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl gradient-blue-indigo text-white shadow-sm">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">E-Commerce Webhooks & WhatsApp Simulator</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Trigger Shopify/ERP events & automated WhatsApp cart recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

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

        {/* Form Content */}
        {activeTab === "order" ? (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Simulated Order Number</label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Carrier Service</label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        ) : activeTab === "inventory" ? (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Product SKU</label>
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
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Variant Size</label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 30ml, 50ml, L"
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">New Available Stock</label>
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
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-zinc-700 dark:text-zinc-300 font-semibold block mb-1">Target Abandoned Cart Session</label>
              <select
                value={recoverySession}
                onChange={(e) => setRecoverySession(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">⚡ All Unrecovered Abandoned Carts (Batch Dispatch)</option>
                <option value="sess_abc123">Sarah Smith (sess_abc123) - SAVE15 (15% off)</option>
                <option value="sess_xyz789">Ali Khan (sess_xyz789) - RECOVER10 (10% off)</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Tag className="h-3.5 w-3.5" />
                <span>Automated Meta WhatsApp Recovery Flow</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                Constructs a personalized message with the customer's abandoned items, applies their discount code, attaches a direct checkout link, and dispatches via Meta Graph API.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300 select-none">
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

        {/* Result Message */}
        {result && (
          <div
            className={`p-3 rounded-xl text-xs border space-y-1.5 ${
              result.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}
          >
            {result.success ? (
              <>
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {activeTab === "recovery"
                      ? `WhatsApp Cart Recovery Triggered! Dispatched: ${
                          result.data?.result?.total_dispatched ?? (result.data?.result?.status === "sent" ? 1 : 0)
                        }`
                      : result.data?.message || "Webhook event processed successfully!"}
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
                  <pre className="mt-1 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-800 dark:text-zinc-200 font-mono whitespace-pre-wrap">
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
          <Button variant="secondary" size="sm" onClick={onClose}>
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
            className={activeTab === "recovery" ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white" : ""}
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
  );
}
