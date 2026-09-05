"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Package,
  ShoppingCart,
  Search,
  Zap,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  UploadCloud,
  X,
  Check,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  ShoppingBag,
  Store,
  Upload,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { ShopifyConnectModal } from "@/components/dashboard/ShopifyConnectModal";
import { WooCommerceConnectModal } from "@/components/dashboard/WooCommerceConnectModal";
import { CsvUploadModal } from "@/components/dashboard/CsvUploadModal";
import { Card, Badge, Button } from "@/lib/ui";
import { api, Product, Order, StoreResponse } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProductImage } from "@/lib/productImages";

export default function CatalogAndOrdersPage() {
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [stores, setStores] = useState<StoreResponse[]>([]);
  const [activeStore, setActiveStore] = useState<StoreResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
  const [isWooCommerceModalOpen, setIsWooCommerceModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    title: "",
    sku: "",
    category: "Apparel",
    price: "",
    stock_quantity: "",
    sizes: "S: 10, M: 8, L: 0, XL: 5",
    description: "",
  });
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [storesData, ords] = await Promise.all([
        api.listStores().catch(() => []),
        api.getOrders().catch(() => []),
      ]);
      setStores(storesData);
      setOrders(ords);

      if (storesData.length > 0) {
        const store = activeStore || storesData[0];
        setActiveStore(store);
        const storeProds = await api.getStoreProducts(store.id).catch(() => []);
        setProducts(storeProds);
      } else {
        setProducts([]);
      }
    } catch (e) {
      console.error("Error loading catalog/orders:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const filteredOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  // Handle Add Product Submit
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.title || !newProduct.sku || !newProduct.price) return;

    // Parse size variants from text input
    const parsedVariants = newProduct.sizes
      .split(",")
      .map((item) => {
        const [size, stockStr] = item.split(":").map((s) => s.trim());
        return { size: size || "Standard", stock: parseInt(stockStr, 10) || 0 };
      })
      .filter((v) => v.size);

    const priceNum = parseFloat(newProduct.price) || 0;
    const stockNum = parseInt(newProduct.stock_quantity, 10) || 0;

    const createdItem: Product = {
      id: Date.now(),
      store_id: activeStore?.id,
      sku: newProduct.sku.toUpperCase(),
      title: newProduct.title,
      category: newProduct.category,
      price: priceNum,
      stock_quantity: stockNum > 0 ? stockNum : parsedVariants.reduce((sum, v) => sum + v.stock, 0),
      size_variants: parsedVariants.length > 0 ? parsedVariants : [{ size: "Standard", stock: stockNum }],
      description: newProduct.description || "Premium catalog item.",
    };

    setProducts((prev) => [createdItem, ...prev]);
    setFormSuccessMessage("Product added to store catalog successfully! ✓");

    setTimeout(() => {
      setFormSuccessMessage(null);
      setIsAddProductOpen(false);
      setNewProduct({
        title: "",
        sku: "",
        category: "Apparel",
        price: "",
        stock_quantity: "",
        sizes: "S: 10, M: 8, L: 0, XL: 5",
        description: "",
      });
      setUploadFileName(null);
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white transition-colors">
      <Header
        title="Catalog & Fulfillment Hub"
        description="Inspect store inventory, variant stock levels, direct store sync, and customer order management."
        onRefresh={loadData}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
        {/* Top Controls Bar: Sub-Navigation Tabs, Search & Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-200/80 dark:bg-zinc-900 rounded-2xl border border-zinc-300 dark:border-zinc-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 whitespace-nowrap min-h-[38px] ${
                activeTab === "products"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Package className="h-4 w-4 shrink-0" />
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 whitespace-nowrap min-h-[38px] ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              Orders ({orders.length})
            </button>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "products" ? "products, SKUs..." : "orders, customers..."}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {activeTab === "products" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsShopifyModalOpen(true)}
                  className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 min-h-[38px] shrink-0 font-semibold"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Shopify</span>
                </Button>

                <Button
                  variant="gradient"
                  size="sm"
                  onClick={() => setIsAddProductOpen(true)}
                  className="shrink-0 gap-1.5 min-h-[38px]"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Products & Variants Table */}
        {activeTab === "products" && (
          <>
            {products.length === 0 && !loading ? (
              /* Clean Empty State Card when tenant has 0 products */
              <Card className="p-8 sm:p-12 text-center rounded-3xl border-dashed border-2 border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/50 shadow-sm">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="h-16 w-16 rounded-3xl gradient-blue-indigo flex items-center justify-center text-white mx-auto shadow-xl shadow-blue-500/20">
                    <Package className="h-8 w-8" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      Your Store Catalog is Empty
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Synchronize with your Shopify or WooCommerce store, or upload an inventory spreadsheet to populate products.
                    </p>
                  </div>

                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setIsShopifyModalOpen(true)}
                      className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                    >
                      <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold">Connect Shopify</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Direct 1-Click Sync</span>
                    </button>

                    <button
                      onClick={() => setIsWooCommerceModalOpen(true)}
                      className="p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                    >
                      <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <Store className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold">WooCommerce</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">REST API Sync</span>
                    </button>

                    <button
                      onClick={() => setIsCsvModalOpen(true)}
                      className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-800 dark:text-blue-300 transition-all flex flex-col items-center justify-center gap-2 group text-center"
                    >
                      <div className="h-10 w-10 rounded-xl gradient-blue-indigo text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold">Upload CSV</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Excel Spreadsheet</span>
                    </button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xl">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-xs min-w-[640px]">
                    <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-4">SKU / Product Title</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Price</th>
                        <th className="p-4">Total Stock</th>
                        <th className="p-4">Size Variants Breakdown</th>
                        <th className="p-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-500">
                            Loading products from store database...
                          </td>
                        </tr>
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-500">
                            No products match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => {
                          const isLowStock = p.stock_quantity <= 5;
                          const hasOutOfStockVariant = (p.size_variants || []).some((v) => v.stock === 0);
                          const img = getProductImage(p.sku, p.category, p.title, p.image_url);

                          return (
                            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={img}
                                    alt={p.title}
                                    className="h-10 w-10 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 shrink-0"
                                  />
                                  <div>
                                    <div className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{p.title}</div>
                                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{p.sku}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                              </td>
                              <td className="p-4 font-black text-zinc-900 dark:text-white">{formatCurrency(p.price)}</td>
                              <td className="p-4 font-semibold text-zinc-700 dark:text-zinc-200">{p.stock_quantity} units</td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                  {(p.size_variants || []).map((v, idx) => (
                                    <span
                                      key={idx}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                        v.stock > 0
                                          ? "bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                                          : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25 text-rose-600 dark:text-rose-400"
                                      }`}
                                    >
                                      {v.size}: {v.stock}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                {p.stock_quantity === 0 ? (
                                  <Badge variant="destructive" dot={true}>Out of Stock</Badge>
                                ) : hasOutOfStockVariant ? (
                                  <Badge variant="warning" dot={true}>Variant Alert</Badge>
                                ) : isLowStock ? (
                                  <Badge variant="warning" dot={true}>Low Stock</Badge>
                                ) : (
                                  <Badge variant="success" dot={true}>In Stock</Badge>
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
          </>
        )}

        {/* Tab 2: Customer Orders Table */}
        {activeTab === "orders" && (
          <Card className="p-0 overflow-hidden border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[680px]">
                <thead className="bg-zinc-100/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Order # / Date</th>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Items & Sizes</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Carrier & Tracking</th>
                    <th className="p-4 text-right">Fulfillment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        Loading customer orders from database...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm block">#{o.order_number}</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{formatDate(o.created_at)}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-zinc-900 dark:text-white">{o.customer_name}</div>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">{o.customer_email}</span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {(o.items || []).map((item, idx) => (
                              <div key={idx} className="text-zinc-700 dark:text-zinc-300 text-[11px]">
                                • {item.name} {item.size ? `(Size ${item.size})` : ""} × {item.quantity}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-black text-zinc-900 dark:text-white">{formatCurrency(o.total_amount)}</td>
                        <td className="p-4">
                          {o.tracking_number ? (
                            <div className="space-y-1">
                              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 block font-semibold">
                                {o.carrier}: {o.tracking_number}
                              </span>
                              {o.tracking_url && (
                                <a
                                  href={o.tracking_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  Live Carrier Link
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {o.estimated_delivery && (
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                                  ETA: {o.estimated_delivery}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500 text-[11px]">No tracking yet</span>
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
                            dot={true}
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

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsAddProductOpen(false)}
          />

          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shrink-0">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Add New Catalog Product</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Add an inventory item with variant stock levels</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleCreateProduct} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {formSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  {formSuccessMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    placeholder="e.g. Vintage Leather Jacket"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">SKU Identifier *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="e.g. JACKET-LTHR-006"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Apparel">Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="89.99"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Total Stock</label>
                  <input
                    type="number"
                    value={newProduct.stock_quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                    placeholder="23"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                  Size Variants (Format: Size: Stock, Size: Stock)
                </label>
                <input
                  type="text"
                  value={newProduct.sizes}
                  onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
                  placeholder="S: 10, M: 8, L: 0, XL: 5"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Photo Upload Zone */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Product Photography</label>
                <div
                  onClick={() => setUploadFileName("jacket_preview_hd.jpg")}
                  className="p-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/80 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors text-center"
                >
                  <UploadCloud className="h-6 w-6 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {uploadFileName ? `Uploaded: ${uploadFileName}` : "Click or drag photo to upload"}
                  </span>
                  <span className="text-[10px] text-zinc-500">Supports JPG, PNG, WEBP up to 5MB</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddProductOpen(false)} className="min-h-[40px]">
                  Cancel
                </Button>
                <Button variant="gradient" size="sm" type="submit" className="min-h-[40px]">
                  Save Product to Catalog
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shopify Connect Modal */}
      {activeStore && (
        <ShopifyConnectModal
          isOpen={isShopifyModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsShopifyModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* WooCommerce Connect Modal */}
      {activeStore && (
        <WooCommerceConnectModal
          isOpen={isWooCommerceModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsWooCommerceModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* CSV Upload Modal */}
      {activeStore && (
        <CsvUploadModal
          isOpen={isCsvModalOpen}
          storeId={activeStore.id}
          storeName={activeStore.name}
          onClose={() => setIsCsvModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* Webhook Simulator Modal */}
      <WebhookSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
