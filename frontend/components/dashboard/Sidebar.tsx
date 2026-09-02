"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  Sparkles,
  Store,
  ExternalLink,
  Bot,
  Activity,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    title: "Overview & Analytics",
    href: "/dashboard",
    icon: LayoutDashboard,
    badge: "Live",
  },
  {
    title: "Catalog & Inventory",
    href: "/dashboard/catalog",
    icon: Package,
  },
  {
    title: "AI Chat Logs & Tools",
    href: "/dashboard/conversations",
    icon: MessageSquare,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl flex flex-col h-screen sticky top-0 z-20">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-white text-sm tracking-tight leading-none group-hover:text-blue-400 transition-colors">
              AutoCommerce
            </h1>
            <span className="text-[10px] text-zinc-400 font-mono">Merchant Admin</span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="p-3.5 space-y-1 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-3 py-1.5">
          Management & Analytics
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                isActive
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/70 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-zinc-400")} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-6">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-3 py-1.5">
            Storefront & Testing
          </div>
          <Link
            href="/"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/70 transition-all border border-transparent"
          >
            <div className="flex items-center gap-2.5">
              <Store className="h-4 w-4 text-emerald-400" />
              <span>Customer Storefront</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>

          <Link
            href="/widget"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/70 transition-all border border-transparent"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Standalone Widget</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>
        </div>
      </nav>

      {/* Backend Engine Status Footer */}
      <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/60 m-3 rounded-2xl">
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-white">FastAPI AI Engine</span>
        </div>
        <p className="text-[10px] text-zinc-400 leading-tight">Grounded Function Calling & Live SQLite/Supabase Sync</p>
      </div>
    </aside>
  );
}
