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
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Live Chat Logs",
    href: "/dashboard/conversations",
    icon: MessageSquare,
  },
  {
    title: "Catalog & Orders",
    href: "/dashboard/catalog",
    icon: Package,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base tracking-tight leading-none">AutoCommerce</h1>
            <span className="text-[11px] text-blue-400 font-medium">AI Agent Admin</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-4 space-y-1.5 flex-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Management
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/60"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-slate-400")} />
              {item.title}
            </Link>
          );
        })}

        <div className="pt-6">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Storefront & Testing
          </div>
          <Link
            href="/"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <Store className="h-4 w-4 text-emerald-400" />
              <span>Customer Storefront</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Link>

          <Link
            href="/widget"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-900/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Standalone Widget</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Link>
        </div>
      </nav>

      {/* Backend Engine Status Footer */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-900/40 m-3 rounded-xl">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-white">FastAPI Agent Engine</span>
        </div>
        <p className="text-[11px] text-slate-400">OpenAI Function Calling & SQLite/Postgres live</p>
      </div>
    </aside>
  );
}
