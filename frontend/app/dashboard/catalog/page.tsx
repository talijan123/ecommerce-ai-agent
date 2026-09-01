"use client";

import React, { useEffect, useState } from "react";
import {
  Package,
  ShoppingCart,
  Search,
  Zap,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { Card, Badge, Button } from "@/lib/ui";
import { api, Product, Order } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function CatalogAndOrdersPage() {
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [prods, ords] = await Promise.all([api.getProducts(), api.getOrders()]);
      setProducts(prods);
      setOrders(ords);
    } catch (e) {
      console.error("Error loading catalog/orders:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = products.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Catalog & Fulfillment Hub"
        description="Inspect store inventory, variant stock levels, and order fulfillment status."
        onRefresh={loadData}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main className="p-8 space-y-6 flex-1">
        {/* Controls Bar: Tab Switching & Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "products"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Package className="h-4 w-4" />
              Products & Variants ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Customer Orders ({orders.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Tab 1: Products Table */}
        {activeTab === "products" && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">SKU / Product</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Total Stock</th>
                    <th className="p-4">Size Variants Breakdown</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Loading products from database...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No products match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock_quantity <= 5;
                      const hasOutOfStockVariant = (p.size_variants || []).some((v) => v.stock === 0);
                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white text-sm">{p.title}</div>
                            <span className="font-mono text-[11px] text-slate-500">{p.sku}</span>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">{p.category}</Badge>
                          </td>
                          <td className="p-4 font-bold text-white">{formatCurrency(p.price)}</td>
                          <td className="p-4 font-semibold text-slate-200">{p.stock_quantity} units</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {(p.size_variants || []).map((v, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                                    v.stock > 0
                                      ? "bg-slate-800 border-slate-700 text-slate-200"
                                      : "bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold"
                                  }`}
                                >
                                  {v.size}: {v.stock}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {p.stock_quantity === 0 ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : hasOutOfStockVariant ? (
                              <Badge variant="warning">Variant Alert</Badge>
                            ) : isLowStock ? (
                              <Badge variant="warning">Low Stock</Badge>
                            ) : (
                              <Badge variant="success">In Stock</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 2: Orders Table */}
        {activeTab === "orders" && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4">Order #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Tracking Details</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Loading orders from database...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-bold text-white text-sm">#{o.order_number}</span>
                          <span className="text-[11px] text-slate-500 block">{formatDate(o.created_at)}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-white">{o.customer_name}</div>
                          <span className="text-[11px] text-slate-400">{o.customer_email}</span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {(o.items || []).map((item, idx) => (
                              <div key={idx} className="text-slate-300 text-[11px]">
                                • {item.name} {item.size ? `(Size ${item.size})` : ""} × {item.quantity}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-white">{formatCurrency(o.total_amount)}</td>
                        <td className="p-4">
                          {o.tracking_number ? (
                            <div className="space-y-1">
                              <span className="font-mono text-[11px] text-blue-400 block">
                                {o.carrier}: {o.tracking_number}
                              </span>
                              {o.tracking_url && (
                                <a
                                  href={o.tracking_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                                >
                                  Carrier Tracking Link
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {o.estimated_delivery && (
                                <span className="text-[10px] text-slate-400 block">
                                  ETA: {o.estimated_delivery}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No tracking yet</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Badge
                            variant={
                              o.status === "Delivered"
                                ? "success"
                                : o.status === "Shipped"
                                ? "indigo"
                                : o.status === "Processing"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {o.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Webhook Simulator Modal */}
      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
