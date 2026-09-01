"use client";

import React, { useState } from "react";
import { X, Send, Package, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Card, CardTitle, Badge } from "@/lib/ui";
import { api } from "@/lib/api";

interface WebhookSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WebhookSimulator({ isOpen, onClose, onSuccess }: WebhookSimulatorProps) {
  const [activeTab, setActiveTab] = useState<"order" | "inventory">("order");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Order webhook mock form
  const [orderNumber, setOrderNumber] = useState(`ORD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [customerEmail, setCustomerEmail] = useState("john.customer@example.com");
  const [customerName, setCustomerName] = useState("John Customer");
  const [carrier, setCarrier] = useState("DHL Express");

  // Inventory webhook mock form
  const [sku, setSku] = useState("TSHIRT-WHT-001");
  const [size, setSize] = useState("L");
  const [availableStock, setAvailableStock] = useState("25");

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
          { title: "Classic White T-Shirt", size: "M", quantity: 1, price: 24.99 },
          { title: "Organic Cotton Hoodie", size: "L", quantity: 1, price: 49.99 },
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">E-Commerce Webhook Simulator</h3>
              <p className="text-xs text-slate-400">Trigger simulated Shopify / WooCommerce events</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setActiveTab("order");
              setResult(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "order"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📦 Order Created Webhook
          </button>
          <button
            onClick={() => {
              setActiveTab("inventory");
              setResult(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "inventory"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🔄 Inventory Stock Sync
          </button>
        </div>

        {/* Form Content */}
        {activeTab === "order" ? (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-400 font-medium block mb-1">Simulated Order Number</label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 font-medium block mb-1">Carrier Service</label>
              <input
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-400 font-medium block mb-1">Product SKU</label>
              <select
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="TSHIRT-WHT-001">Classic White T-Shirt (TSHIRT-WHT-001)</option>
                <option value="JEANS-DNM-002">Slim Fit Denim Jeans (JEANS-DNM-002)</option>
                <option value="TECH-HDPH-003">Headphones (TECH-HDPH-003)</option>
                <option value="SHOE-RUN-004">Running Shoes (SHOE-RUN-004)</option>
                <option value="HOODIE-ORG-005">Organic Hoodie (HOODIE-ORG-005)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 font-medium block mb-1">Variant Size</label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. L or 32"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-slate-400 font-medium block mb-1">New Available Stock</label>
                <input
                  type="number"
                  value={availableStock}
                  onChange={(e) => setAvailableStock(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div
            className={`p-3 rounded-xl text-xs border flex items-center gap-2 ${
              result.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            }`}
          >
            {result.success ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{result.data?.message || "Webhook event processed successfully!"}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Error: {result.error}</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="gradient"
            size="sm"
            isLoading={loading}
            onClick={activeTab === "order" ? handleSendOrderWebhook : handleSendInventoryWebhook}
          >
            <Send className="h-3.5 w-3.5" />
            Dispatch Webhook
          </Button>
        </div>
      </div>
    </div>
  );
}
