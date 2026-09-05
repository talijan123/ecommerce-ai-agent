"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  Sparkles,
  Store,
  ExternalLink,
  Bot,
  LogOut,
  User,
  ShieldCheck,
  CheckCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useMobileNav } from "@/context/MobileNavContext";

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

interface SidebarInnerProps {
  onNavClick?: () => void;
  isMobile?: boolean;
}

function SidebarInner({ onNavClick, isMobile }: SidebarInnerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { close } = useMobileNav();

  const handleLinkClick = () => {
    if (onNavClick) onNavClick();
    if (isMobile) close();
  };

  const handleLogout = () => {
    logout();
    if (isMobile) close();
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <Link href="/" onClick={handleLinkClick} className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-zinc-900 dark:text-white text-sm tracking-tight leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              AutoCommerce
            </h1>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">Merchant Admin</span>
          </div>
        </Link>

        {/* Mobile Close Button */}
        {isMobile && (
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation drawer"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="p-3.5 space-y-1 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-3 py-1.5">
          Management & Analytics
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200",
                isActive
                  ? "bg-blue-600/10 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900/70 border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-400")} />
                <span>{item.title}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-6">
          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-3 py-1.5">
            Storefront & Testing
          </div>
          <Link
            href="/storefront"
            onClick={handleLinkClick}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900/70 transition-all border border-transparent"
          >
            <div className="flex items-center gap-2.5">
              <Store className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span>Customer Storefront</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>

          <Link
            href="/widget"
            onClick={handleLinkClick}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900/70 transition-all border border-transparent"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
              <span>Standalone Widget</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </Link>
        </div>
      </nav>

      {/* Authenticated User Profile & Logout Section */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <div className="h-8 w-8 rounded-lg gradient-blue-indigo flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                {(user.full_name || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                    {user.full_name || "Merchant"}
                  </p>
                  {user.is_verified && (
                    <span title="Verified Merchant" className="inline-flex items-center">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={handleLinkClick}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white gradient-blue-indigo shadow-sm"
          >
            <User className="h-3.5 w-3.5" />
            <span>Sign In</span>
          </Link>
        )}
      </div>

      {/* Backend Engine Status Footer */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 m-2 rounded-xl">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-zinc-900 dark:text-white">FastAPI AI Engine</span>
        </div>
        <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-tight">
          Grounded Multi-Tenant Sync
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* 1. Desktop Static Sidebar */}
      <aside className="hidden md:flex md:w-64 border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl flex-col h-screen sticky top-0 z-20 transition-colors shrink-0">
        <SidebarInner isMobile={false} />
      </aside>

      {/* 2. Mobile Responsive Slide-Over Drawer */}
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Drawer Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl md:hidden transition-transform duration-300 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarInner isMobile={true} onNavClick={close} />
      </aside>
    </>
  );
}
