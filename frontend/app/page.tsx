"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  Bot,
  LayoutDashboard,
  CheckCircle2,
  Tag,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  X,
  Plus,
  Minus,
  Trash2,
  PackageSearch,
  MessageSquare,
  Check,
  Zap,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Button, Card, Badge } from "@/lib/ui";
import { api, Product } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { getProductImage } from "@/lib/productImages";

interface CartItem {
  productId: number;
  sku: string;
  title: string;
  price: number;
  size: string;
  quantity: number;
  image: string;
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc">("featured");

  // Selected variant size per product ID: { [productId]: selectedSize }
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>({});

  // Image load state tracking
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [addedItemAnim, setAddedItemAnim] = useState<number | null>(null);

  // Fetch live products from backend
  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProducts();
        setProducts(data);

        // Pre-select first available size variant for each product
        const initialSizes: Record<number, string> = {};
        data.forEach((p) => {
          const firstInStock = (p.size_variants || []).find((v) => v.stock > 0);
          initialSizes[p.id] = firstInStock?.size || p.size_variants?.[0]?.size || "Standard";
        });
        setSelectedSizes(initialSizes);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Categories list derived dynamically
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [products]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Category filter
        if (selectedCategory !== "All" && product.category !== selectedCategory) {
          return false;
        }
        // In-stock filter
        if (inStockOnly && product.stock_quantity <= 0) {
          return false;
        }
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = product.title.toLowerCase().includes(q);
          const matchSku = product.sku.toLowerCase().includes(q);
          const matchCategory = product.category.toLowerCase().includes(q);
          const matchDesc = (product.description || "").toLowerCase().includes(q);
          if (!matchTitle && !matchSku && !matchCategory && !matchDesc) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        return a.id - b.id;
      });
  }, [products, selectedCategory, inStockOnly, searchQuery, sortBy]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    const size = selectedSizes[product.id] || product.size_variants?.[0]?.size || "Standard";
    const image = getProductImage(product.sku, product.category, product.title, product.image_url);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.size === size);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.size === size
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          title: product.title,
          price: product.price,
          size,
          quantity: 1,
          image,
        },
      ];
    });

    // Micro feedback animation
    setAddedItemAnim(product.id);
    setTimeout(() => setAddedItemAnim(null), 1500);
  };

  const updateCartQuantity = (productId: number, size: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && item.size === size) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (productId: number, size: string) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.size === size)));
  };

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartPrice = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Trigger AI Chat helper from any UI button
  const triggerAiChat = (prompt: string, email?: string) => {
    window.dispatchEvent(
      new CustomEvent("open-ai-chat", {
        detail: { prompt, email },
      })
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-2xl sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Online Status */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-blue-400 transition-colors">
                  AutoCommerce
                </span>
                <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase -mt-0.5">
                  Autonomous AI Agent
                </span>
              </div>
            </Link>

            {/* Live AI Status Badge */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold tracking-tight">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              AI Agent Online
            </div>
          </div>

          {/* Center Search Input */}
          <div className="flex-1 max-w-md hidden sm:block relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by title, SKU, or keyword..."
              className="w-full bg-zinc-900/90 border border-zinc-800/90 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right Action Icons: Cart & Dashboard */}
          <div className="flex items-center gap-2.5">
            {/* Cart Button with Count Badge */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:text-white hover:border-zinc-700 hover:bg-zinc-800/80 transition-all active:scale-95 flex items-center gap-2 text-xs font-semibold px-3"
            >
              <ShoppingBag className="h-4 w-4 text-blue-400" />
              <span className="hidden sm:inline">Cart</span>
              {totalCartCount > 0 && (
                <span className="h-5 min-w-[20px] px-1 rounded-full gradient-blue-indigo text-white text-[10px] font-bold flex items-center justify-center animate-in zoom-in-50">
                  {totalCartCount}
                </span>
              )}
            </button>

            {/* Merchant Dashboard Link */}
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" className="gap-2">
                <LayoutDashboard className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 px-4 sm:px-6 border-b border-zinc-800/80 bg-grid-pattern">
        {/* Subtle Radial Glow in Center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <Badge variant="indigo" className="px-3.5 py-1 text-xs gap-1.5 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            Autonomous Tool-Calling PoC • OpenAI Function Calling Grounded
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight sm:leading-none text-white">
            Next-Gen E-Commerce with <br className="hidden sm:block" />
            <span className="gradient-text">Autonomous AI Agents</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Experience an intelligent store assistant connected directly to live SQLite/Supabase inventory, real-time carrier tracking APIs, and cart recovery systems.
          </p>

          {/* Interactive Test Prompts Bar */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold text-zinc-400 block mb-2 uppercase tracking-wider">
              Click to Test Live AI Capabilities:
            </span>
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              <button
                onClick={() => triggerAiChat("Where is my order #1042?")}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:border-blue-500/50 hover:bg-zinc-800 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                <span>"Where is order #1042?"</span>
                <span className="text-[10px] text-zinc-500 font-mono">Live Tracking</span>
              </button>

              <button
                onClick={() => triggerAiChat("Do you have the Classic White T-Shirt in size L?")}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:border-amber-500/50 hover:bg-zinc-800 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <TrendingUp className="h-3.5 w-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>"Size L in White T-Shirt?"</span>
                <span className="text-[10px] text-zinc-500 font-mono">Stock Intelligence</span>
              </button>

              <button
                onClick={() =>
                  triggerAiChat(
                    "Can I get a discount code for my abandoned cart? My email is sarah.smith@example.com",
                    "sarah.smith@example.com"
                  )
                }
                className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:border-emerald-500/50 hover:bg-zinc-800 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <Tag className="h-3.5 w-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>"Cart promo for Sarah"</span>
                <span className="text-[10px] text-zinc-500 font-mono">Cart Recovery</span>
              </button>

              <button
                onClick={() => triggerAiChat("Mera order #1043 kab tak deliver hoga?")}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <Zap className="h-3.5 w-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>"Mera order #1043?"</span>
                <span className="text-[10px] text-zinc-500 font-mono">Roman Urdu</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Explorer */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-8">
        {/* Controls Bar: Category Pills, Search on Mobile, and Sort */}
        <div className="flex flex-col gap-4">
          {/* Mobile Search Bar */}
          <div className="sm:hidden relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, SKUs..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-zinc-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Categories Pill Bar & Filters Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
              {categories.map((cat) => {
                const count =
                  cat === "All"
                    ? products.length
                    : products.filter((p) => p.category === cat).length;
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "bg-zinc-900 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter Switches & Sort Dropdown */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              {/* In Stock Only Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
                />
                <span>In-Stock Only</span>
              </label>

              {/* Sort selector */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300">
                <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-zinc-200 text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="featured" className="bg-zinc-900 text-zinc-200">Featured</option>
                  <option value="price-asc" className="bg-zinc-900 text-zinc-200">Price: Low to High</option>
                  <option value="price-desc" className="bg-zinc-900 text-zinc-200">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-96 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 p-5 space-y-4 shimmer-mask"
              >
                <div className="h-44 rounded-2xl bg-zinc-800/50" />
                <div className="h-4 w-1/3 bg-zinc-800/50 rounded" />
                <div className="h-6 w-3/4 bg-zinc-800/50 rounded" />
                <div className="h-4 w-full bg-zinc-800/30 rounded" />
                <div className="h-10 w-full bg-zinc-800/50 rounded-xl mt-4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty Search / Filter State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl max-w-lg mx-auto space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto text-zinc-400">
              <PackageSearch className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-white">No products found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              We couldn't find any products matching "{searchQuery}" with the current active filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
                setInStockOnly(false);
              }}
            >
              Reset All Filters
            </Button>
          </div>
        )}

        {/* Product Cards Grid */}
        {!loading && filteredProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const currentSize =
                selectedSizes[product.id] ||
                product.size_variants?.[0]?.size ||
                "Standard";

              const currentVariant = (product.size_variants || []).find(
                (v) => v.size === currentSize
              );
              const variantStock =
                currentVariant !== undefined ? currentVariant.stock : product.stock_quantity;
              const isOutOfStock = variantStock === 0;

              const imageUrl = getProductImage(product.sku, product.category, product.title, product.image_url);
              const isImageLoaded = imagesLoaded[product.id] || false;

              return (
                <div
                  key={product.id}
                  className="group rounded-3xl border border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/90 p-5 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-zinc-700/80 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Image Wrapper with Shimmer Skeleton */}
                    <div className="relative h-48 sm:h-52 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/60">
                      {!isImageLoaded && (
                        <div className="absolute inset-0 bg-zinc-900 shimmer-mask flex items-center justify-center">
                          <Bot className="h-8 w-8 text-zinc-700" />
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={product.title}
                        onLoad={() =>
                          setImagesLoaded((prev) => ({ ...prev, [product.id]: true }))
                        }
                        className={`h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ${
                          isImageLoaded ? "opacity-100" : "opacity-0"
                        }`}
                      />

                      {/* Top Badges Overlay */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <Badge variant="secondary" className="backdrop-blur-md bg-zinc-950/80 text-[10px]">
                          {product.category}
                        </Badge>
                        <span className="font-mono text-[10px] text-zinc-300 font-semibold px-2 py-0.5 rounded-md bg-zinc-950/80 backdrop-blur-md border border-zinc-800">
                          {product.sku}
                        </span>
                      </div>
                    </div>

                    {/* Product Details Header */}
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {product.title}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {product.description || "Premium quality e-commerce product."}
                      </p>
                    </div>

                    {/* Interactive Size Variant Selector Chips */}
                    {product.size_variants && product.size_variants.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>Select Size:</span>
                          <span className="font-medium text-zinc-300">
                            {variantStock > 0 ? (
                              <span className="text-emerald-400 font-semibold">
                                {variantStock} in stock
                              </span>
                            ) : (
                              <span className="text-rose-400 font-semibold">
                                Out of stock!
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {product.size_variants.map((v, idx) => {
                            const isSelected = currentSize === v.size;
                            const isVOutOfStock = v.stock === 0;
                            return (
                              <button
                                key={idx}
                                onClick={() =>
                                  setSelectedSizes((prev) => ({
                                    ...prev,
                                    [product.id]: v.size,
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 border ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-500 text-white shadow-sm shadow-blue-500/30"
                                    : isVOutOfStock
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 line-through opacity-80"
                                    : "bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                                }`}
                                title={
                                  isVOutOfStock
                                    ? `Size ${v.size} is out of stock. Click 'Ask AI' for alternative recommendations.`
                                    : `Size ${v.size} (${v.stock} units left)`
                                }
                              >
                                {v.size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Price, Add to Cart & Ask AI Trigger */}
                  <div className="mt-5 pt-4 border-t border-zinc-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xl font-black text-white tracking-tight">
                          {formatCurrency(product.price)}
                        </span>
                      </div>

                      {/* Stock Indicator Dot */}
                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            product.stock_quantity > 5
                              ? "bg-emerald-400"
                              : product.stock_quantity > 0
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                        />
                        <span
                          className={
                            product.stock_quantity > 0 ? "text-zinc-300" : "text-rose-400"
                          }
                        >
                          {product.stock_quantity > 0
                            ? `Total ${product.stock_quantity} left`
                            : "Out of Stock"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={addedItemAnim === product.id ? "primary" : "secondary"}
                        size="sm"
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(product)}
                        className={`w-full gap-1.5 text-xs font-semibold ${
                          addedItemAnim === product.id ? "bg-emerald-600 border-emerald-500" : ""
                        }`}
                      >
                        {addedItemAnim === product.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Added!
                          </>
                        ) : isOutOfStock ? (
                          "Out of Stock"
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            Add to Cart
                          </>
                        )}
                      </Button>

                      {/* Contextual Ask AI Button */}
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() =>
                          triggerAiChat(
                            `Do you have the ${product.title} in size ${currentSize}? If out of stock, what alternatives do you recommend?`
                          )
                        }
                        className="w-full gap-1 text-[11px]"
                      >
                        <Sparkles className="h-3 w-3 text-blue-400" />
                        Ask AI
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Flyout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
              {/* Cart Header */}
              <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Your Shopping Cart</h2>
                    <span className="text-[11px] text-zinc-400">{totalCartCount} items selected</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <ShoppingBag className="h-12 w-12 text-zinc-600 mx-auto" />
                    <p className="text-sm font-medium text-zinc-400">Your cart is currently empty.</p>
                    <Button variant="outline" size="sm" onClick={() => setIsCartOpen(false)}>
                      Explore Catalog
                    </Button>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40"
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-16 w-16 rounded-xl object-cover border border-zinc-800"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] py-0">
                            Size {item.size}
                          </Badge>
                          <span className="text-xs font-bold text-white">
                            {formatCurrency(item.price)}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateCartQuantity(item.productId, item.size, -1)}
                            className="p-1 rounded-md bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-zinc-200 px-1 font-mono">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.productId, item.size, 1)}
                            className="p-1 rounded-md bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeCartItem(item.productId, item.size)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-zinc-800/80 bg-zinc-900/60 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Subtotal:</span>
                    <span className="text-base font-black text-white">{formatCurrency(totalCartPrice)}</span>
                  </div>

                  {/* Ask AI for Discount Button */}
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      triggerAiChat(
                        "Can I get a discount code for my abandoned cart? My email is sarah.smith@example.com",
                        "sarah.smith@example.com"
                      );
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Ask AI Agent for a Cart Discount
                  </button>

                  <Button
                    variant="gradient"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      alert("Simulated Checkout! In a production deployment, this connects to Stripe or Shopify Checkout.");
                    }}
                  >
                    Proceed to Checkout ({formatCurrency(totalCartPrice)})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 px-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>AutoCommerce AI PoC • Next.js 14, TypeScript, Tailwind CSS, FastAPI, and OpenAI Tool Calling.</p>
          <div className="flex items-center gap-4 text-zinc-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Merchant Admin
            </Link>
            <Link href="/widget" className="hover:text-white transition-colors">
              Embeddable Widget
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

