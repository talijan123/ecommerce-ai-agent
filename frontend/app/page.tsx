"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  FileSpreadsheet,
  Zap,
  TrendingUp,
  Tag,
  CheckCircle2,
  Store,
  ExternalLink,
  ChevronRight,
  Layers,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, Badge } from "@/lib/ui";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function SaaSIndexPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [autoRedirectTime, setAutoRedirectTime] = useState<number | null>(null);

  // Check auth and auto-redirect
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // Authenticated users go directly to dashboard
        router.replace("/dashboard");
      } else {
        // Unauthenticated users automatically route to signup after brief preview
        setAutoRedirectTime(2);
      }
    }
  }, [isAuthenticated, isLoading, router]);

  // Countdown timer for automatic redirect to /signup
  useEffect(() => {
    if (autoRedirectTime === null) return;
    if (autoRedirectTime <= 0) {
      router.push("/signup");
      return;
    }
    const timer = setTimeout(() => {
      setAutoRedirectTime((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoRedirectTime, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center animate-pulse">
          <div className="h-16 w-16 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white shadow-xl shadow-indigo-500/25">
            <Bot className="h-8 w-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">
              Loading AutoCommerce SaaS
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Redirecting to your merchant dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Top Banner with Auto-redirect notice */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white text-[11px] font-semibold py-2 px-4 text-center tracking-wide flex items-center justify-center gap-3">
        <Sparkles className="h-3.5 w-3.5 animate-pulse shrink-0" />
        <span>
          Autonomous Multi-Tenant E-Commerce AI SaaS • Live WhatsApp Cloud API Integration
        </span>
        {autoRedirectTime !== null && autoRedirectTime > 0 && (
          <Link
            href="/signup"
            className="underline font-bold bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition-colors inline-flex items-center gap-1"
          >
            <span>Redirecting to Signup in {autoRedirectTime}s &rarr;</span>
          </Link>
        )}
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-10 w-10 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                AutoCommerce<span className="text-blue-600">.ai</span>
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-wider uppercase -mt-0.5">
                WhatsApp AI SaaS
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle showDropdown={false} />

            <Link
              href="/storefront"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors hidden sm:inline-flex items-center gap-1.5"
            >
              <Store className="h-3.5 w-3.5 text-emerald-500" />
              <span>Demo Storefront</span>
            </Link>

            <Link
              href="/login"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              Sign In
            </Link>

            <Link href="/signup">
              <Button variant="gradient" size="sm" className="gap-1.5 font-bold shadow-md shadow-blue-500/25">
                <span>Start Free Trial</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-grid-pattern">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <Badge variant="indigo" className="px-4 py-1 text-xs gap-2 shadow-sm inline-flex">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
            Autonomous WhatsApp AI SaaS • Multi-Tenant Merchant Platform
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-zinc-900 dark:text-white">
            Transform Your WhatsApp Into An <br className="hidden sm:block" />
            <span className="gradient-text">Autonomous AI Sales Agent</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Deploy intelligent shopping assistants grounded directly in your product catalog. Resolve inquiries in English & Roman Urdu, check real-time stock variants, and recover abandoned carts 24/7.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button variant="gradient" size="lg" className="w-full sm:w-auto gap-2 font-bold shadow-xl shadow-blue-500/25 px-8">
                <span>Deploy Your AI Agent Now</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2 font-semibold">
                <span>Sign In to Dashboard</span>
              </Button>
            </Link>

            <Link href="/storefront" className="w-full sm:w-auto">
              <Button variant="subtle" size="lg" className="w-full sm:w-auto gap-2 font-semibold">
                <Store className="h-4 w-4 text-emerald-500" />
                <span>Browse Store Demo</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Built for Modern E-Commerce Merchants
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Everything you need to onboard stores, ingest catalogs, and deploy autonomous WhatsApp turn execution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg space-y-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <MessageSquare className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              WhatsApp Cloud API Native
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Connect Meta Cloud API in 60 seconds with live token verification, verified business profile validation, and instant QR testing.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg space-y-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Bulk CSV Catalog Ingestion
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Drag-and-drop your product spreadsheet to instantly import SKUs, size variants, pricing, and live inventory balances.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Anti-Hallucination Guardrails
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Agent queries live SQLite/Postgres databases before answering stock or order status, ensuring 100% grounded accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 py-8 px-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} AutoCommerce.ai • Autonomous WhatsApp AI SaaS Platform.</p>
          <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
            <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Create Merchant Account
            </Link>
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/storefront" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
              Storefront Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
