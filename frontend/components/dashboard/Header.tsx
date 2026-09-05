"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  RefreshCw,
  Activity,
  Zap,
  MessageSquare,
  QrCode,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { Button, Badge } from "@/lib/ui";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useMobileNav } from "@/context/MobileNavContext";
import { useAuth } from "@/context/AuthContext";

interface HeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  onOpenSimulator?: () => void;
  onOpenWhatsAppTest?: () => void;
  onOpenSupportTicket?: () => void;
  whatsAppStatus?: "connected" | "sandbox" | "action_required";
}

export function Header({
  title,
  description,
  onRefresh,
  onOpenSimulator,
  onOpenWhatsAppTest,
  onOpenSupportTicket,
  whatsAppStatus = "sandbox",
}: HeaderProps) {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const { isOpen: isMobileNavOpen, toggle: toggleMobileNav } = useMobileNav();
  const { user } = useAuth();

  const isSuperAdmin =
    user?.role === "super_admin" ||
    (user?.email && ["talal@example.com", "admin@autocommerce.ai", "owner@store.com"].includes(user.email.toLowerCase()));

  useEffect(() => {
    async function check() {
      const healthy = await api.checkHealth();
      setIsBackendHealthy(healthy);
    }
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 sm:h-20 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left Title & Mobile Hamburger Button */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={toggleMobileNav}
          aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
          className="p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 md:hidden transition-colors shrink-0"
        >
          {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg md:text-xl font-black text-zinc-900 dark:text-white tracking-tight truncate flex items-center gap-2">
            <span>{title}</span>
            {isSuperAdmin && (
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                Owner Mode
              </span>
            )}
          </h1>
          {description ? (
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xl truncate hidden sm:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right Controls & Quick Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Super Admin Portal Quick Link */}
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className="inline-flex items-center gap-1.5 text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 px-2.5 sm:px-3 h-8 sm:h-9 font-bold rounded-xl transition-all"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Super Admin</span>
            <span className="sm:hidden">Admin</span>
          </Link>
        )}

        {/* Support & Issue Report Modal Trigger */}
        {onOpenSupportTicket && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSupportTicket}
            className="gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-2.5 sm:px-3 h-8 sm:h-9 font-semibold"
          >
            <LifeBuoy className="h-3.5 w-3.5 text-blue-500" />
            <span className="hidden sm:inline">Support</span>
          </Button>
        )}

        {/* WhatsApp Test Quick Action (if handler provided) */}
        {onOpenWhatsAppTest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenWhatsAppTest}
            className="gap-1.5 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 px-2.5 sm:px-3 h-8 sm:h-9 font-bold"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Test WhatsApp</span>
            <span className="sm:hidden">Test</span>
          </Button>
        )}

        {/* Backend Status Indicator */}
        <Badge
          variant={isBackendHealthy ? "success" : isBackendHealthy === false ? "destructive" : "secondary"}
          dot={isBackendHealthy === true}
          className="hidden lg:inline-flex py-1 px-3 text-[11px]"
        >
          <Activity className="h-3 w-3" />
          {isBackendHealthy === null
            ? "Checking..."
            : isBackendHealthy
            ? "API Operational"
            : "API Offline"}
        </Badge>

        {/* Theme Toggle Button */}
        <ThemeToggle showDropdown={false} />

        {/* Refresh Dashboard Button */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh Dashboard Data"
            className="gap-1.5 text-xs p-2 sm:px-3 h-8 sm:h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Refresh</span>
          </Button>
        )}

        {/* Webhooks Simulator Modal Button */}
        {onOpenSimulator && (
          <Button
            variant="gradient"
            size="sm"
            onClick={onOpenSimulator}
            className="gap-1.5 text-xs px-2.5 sm:px-3.5 h-8 sm:h-9 font-bold"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Webhooks</span>
          </Button>
        )}
      </div>
    </header>
  );
}
