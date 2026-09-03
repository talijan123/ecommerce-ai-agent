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
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { WebhookSimulator } from "@/components/dashboard/WebhookSimulator";
import { Card, Badge, Button } from "@/lib/ui";
import { api, Product, Order } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getProductImage } from "@/lib/productImages";

export default function CatalogAndOrdersPage() {
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

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
      const [prods, ords] = await Promise.all([
        api.getProducts(),
        api.getOrders().catch(() => []),
      ]);
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
      sku: newProduct.sku.toUpperCase(),
      title: newProduct.title,
      category: newProduct.category,
      price: priceNum,
      stock_quantity: stockNum > 0 ? stockNum : parsedVariants.reduce((sum, v) => sum + v.stock, 0),
      size_variants: parsedVariants.length > 0 ? parsedVariants : [{ size: "Standard", stock: stockNum }],
      description: newProduct.description || "Premium catalog item.",
    };

    setProducts((prev) => [createdItem, ...prev]);
    setFormSuccessMessage("Product catalog updated successfully! ✓");

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
    <div className="flex-1 flex flex-col">
      <Header
        title="Catalog & Fulfillment Hub"
        description="Inspect store inventory, variant stock levels, carrier tracking, and product management."
        onRefresh={loadData}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      <main className="p-6 sm:p-8 space-y-6 flex-1">
        {/* Top Controls Bar: Sub-Navigation Tabs, Search & Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 ${
                activeTab === "products"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Package className="h-4 w-4" />
              Products & Inventory ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 ${
                activeTab === "orders"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Customer Orders ({orders.length})
            </button>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab === "products" ? "products, SKUs..." : "orders, customers..."}`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {activeTab === "products" && (
              <Button
                variant="gradient"
                size="sm"
                onClick={() => setIsAddProductOpen(true)}
                className="shrink-0 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            )}
          </div>
        </div>

        {/* Tab 1: Products & Variants Table */}
        {activeTab === "products" && (
          <Card className="p-0 overflow-hidden border-zinc-800/80 bg-zinc-900/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">SKU / Product Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Total Stock</th>
                    <th className="p-4">Size Variants Breakdown</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500">
                        Loading products from database...
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
                        <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={img}
                                alt={p.title}
                                className="h-10 w-10 rounded-xl object-cover border border-zinc-800 shrink-0"
                              />
                              <div>
                                <div className="font-bold text-white text-xs sm:text-sm">{p.title}</div>
                                <span className="font-mono text-[10px] text-zinc-400">{p.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                          </td>
                          <td className="p-4 font-black text-white">{formatCurrency(p.price)}</td>
                          <td className="p-4 font-semibold text-zinc-200">{p.stock_quantity} units</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {(p.size_variants || []).map((v, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                    v.stock > 0
                                      ? "bg-zinc-800/80 border-zinc-700 text-zinc-300"
                                      : "bg-rose-500/10 border-rose-500/25 text-rose-400"
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

        {/* Tab 2: Customer Orders Table */}
        {activeTab === "orders" && (
          <Card className="p-0 overflow-hidden border-zinc-800/80 bg-zinc-900/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">Order # / Date</th>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Items & Sizes</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Carrier & Tracking</th>
                    <th className="p-4 text-right">Fulfillment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
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
                      <tr key={o.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="p-4">
                          <span className="font-mono font-bold text-white text-sm block">#{o.order_number}</span>
                          <span className="text-[10px] text-zinc-400">{formatDate(o.created_at)}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white">{o.customer_name}</div>
                          <span className="text-[11px] text-zinc-400 font-mono">{o.customer_email}</span>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {(o.items || []).map((item, idx) => (
                              <div key={idx} className="text-zinc-300 text-[11px]">
                                • {item.name} {item.size ? `(Size ${item.size})` : ""} × {item.quantity}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-black text-white">{formatCurrency(o.total_amount)}</td>
                        <td className="p-4">
                          {o.tracking_number ? (
                            <div className="space-y-1">
                              <span className="font-mono text-[11px] text-blue-400 block font-semibold">
                                {o.carrier}: {o.tracking_number}
                              </span>
                              {o.tracking_url && (
                                <a
                                  href={o.tracking_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                                >
                                  Live Carrier Link
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                              {o.estimated_delivery && (
                                <span className="text-[10px] text-zinc-400 block">
                                  ETA: {o.estimated_delivery}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">No tracking yet</span>
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAddProductOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add New Catalog Product</h3>
                  <p className="text-[11px] text-zinc-400">Add an inventory item with variant stock levels</p>
                </div>
              </div>

              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProduct} className="p-6 space-y-4">
              {formSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {formSuccessMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.title}
                    onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                    placeholder="e.g. Vintage Leather Jacket"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">SKU Identifier *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="e.g. JACKET-LTHR-006"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 uppercase font-mono focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Apparel">Apparel</option>
                    <option value="Footwear">Footwear</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="89.99"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/70"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-300">Total Stock</label>
                  <input
                    type="number"
                    value={newProduct.stock_quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                    placeholder="23"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/70"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-300">
                  Size Variants (Format: Size: Stock, Size: Stock)
                </label>
                <input
                  type="text"
                  value={newProduct.sizes}
                  onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
                  placeholder="S: 10, M: 8, L: 0, XL: 5"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500/70"
                />
              </div>

              {/* Photo Upload Zone */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-zinc-300">Product Photography</label>
                <div
                  onClick={() => setUploadFileName("jacket_preview_hd.jpg")}
                  className="p-4 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900/80 cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-colors text-center"
                >
                  <UploadCloud className="h-6 w-6 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-300">
                    {uploadFileName ? `Uploaded: ${uploadFileName}` : "Click or drag photo to upload"}
                  </span>
                  <span className="text-[10px] text-zinc-500">Supports JPG, PNG, WEBP up to 5MB</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button variant="secondary" size="sm" type="button" onClick={() => setIsAddProductOpen(false)}>
                  Cancel
                </Button>
                <Button variant="gradient" size="sm" type="submit">
                  Save Product to Catalog
                </Button>
              </div>
            </form>
          </div>
        </div>
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
