"use client";

import React, { useEffect, useState } from "react";
import {
  Menu,
  X,
  RefreshCw,
  Activity,
  Zap,
  MessageSquare,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Button, Badge } from "@/lib/ui";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useMobileNav } from "@/context/MobileNavContext";

interface HeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  onOpenSimulator?: () => void;
  onOpenWhatsAppTest?: () => void;
  whatsAppStatus?: "connected" | "sandbox" | "action_required";
}

export function Header({
  title,
  description,
  onRefresh,
  onOpenSimulator,
  onOpenWhatsAppTest,
  whatsAppStatus = "sandbox",
}: HeaderProps) {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const { isOpen: isMobileNavOpen, toggle: toggleMobileNav } = useMobileNav();

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
          <h1 className="text-base sm:text-lg md:text-xl font-black text-zinc-900 dark:text-white tracking-tight truncate">
            {title}
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
