"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button, Card, Badge } from "@/lib/ui";
import { api, Product } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight">AutoCommerce</span>
              <span className="text-[10px] text-blue-400 font-semibold ml-2 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                AI Powered Store
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="secondary" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4 text-blue-400" />
                Merchant Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-6 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/40 via-slate-950 to-slate-950">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="indigo" className="px-3.5 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Autonomous Tool-Calling Agent PoC (Phase 3)
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            E-Commerce Reimagined with <br />
            <span className="gradient-text">Autonomous AI Agents</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Test the live AI chatbot floating in the bottom-right corner. It retrieves real-time order tracking, provides smart out-of-stock size recommendations, recovers abandoned carts, and understands Roman Urdu.
          </p>

          {/* Quick interactive suggestion cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                Real-Time Order Tracking
              </div>
              <p className="text-xs text-slate-400">
                Ask <span className="text-white font-medium">"Where is my order #1042?"</span> to get live carrier tracking links.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                <TrendingUp className="h-4 w-4" />
                Out-of-Stock Intelligence
              </div>
              <p className="text-xs text-slate-400">
                Ask <span className="text-white font-medium">"Size L in Classic White T-Shirt?"</span> to see alternative size suggestions.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Tag className="h-4 w-4" />
                Cart Recovery Discounts
              </div>
              <p className="text-xs text-slate-400">
                Ask for a promo code with email <span className="text-white font-medium">sarah.smith@example.com</span>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Catalog Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 w-full space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Live Store Catalog</h2>
            <p className="text-xs text-slate-400 mt-1">Fetched directly from our SQLAlchemy database</p>
          </div>
          <Badge variant="secondary">{products.length} Products Available</Badge>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
              const outOfStockVariants = (product.size_variants || []).filter((v) => v.stock === 0);
              return (
                <Card
                  key={product.id}
                  className="group hover:border-slate-700 transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline">{product.category}</Badge>
                      <span className="text-xs font-mono text-slate-500">{product.sku}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {product.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                      {product.description || "Premium quality e-commerce product."}
                    </p>

                    {/* Variant Sizes Chips */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-medium text-slate-400 block">Available Variants:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(product.size_variants || []).map((variant, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              variant.stock > 0
                                ? "bg-slate-800 border-slate-700 text-slate-200"
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400 line-through"
                            }`}
                          >
                            Size {variant.size} ({variant.stock} left)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xl font-black text-white">{formatCurrency(product.price)}</span>
                    <Badge variant={product.stock_quantity > 0 ? "success" : "destructive"}>
                      {product.stock_quantity > 0 ? `In Stock (${product.stock_quantity})` : "Out of Stock"}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500">
        <p>AutoCommerce AI PoC • Built with Next.js 14, TypeScript, Tailwind CSS, FastAPI, and OpenAI Tool Calling.</p>
      </footer>
    </div>
  );
}
