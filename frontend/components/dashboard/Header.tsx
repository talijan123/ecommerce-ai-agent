"use client";

import React, { useEffect, useState } from "react";
import { Bot, RefreshCw, Activity, Zap } from "lucide-react";
import { Button } from "@/lib/ui";
import { api } from "@/lib/api";
import { Badge } from "@/lib/ui";

interface HeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  onOpenSimulator?: () => void;
}

export function Header({ title, description, onRefresh, onOpenSimulator }: HeaderProps) {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

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
    <header className="h-18 sm:h-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">{title}</h1>
        {description ? <p className="text-xs text-zinc-400 mt-0.5 max-w-xl">{description}</p> : null}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Backend Status Indicator */}
        <Badge
          variant={isBackendHealthy ? "success" : isBackendHealthy === false ? "destructive" : "secondary"}
          dot={isBackendHealthy === true}
          className="hidden sm:inline-flex py-1 px-3"
        >
          <Activity className="h-3 w-3" />
          {isBackendHealthy === null
            ? "Checking API..."
            : isBackendHealthy
            ? "API Operational"
            : "API Offline"}
        </Badge>

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        )}

        {onOpenSimulator && (
          <Button variant="gradient" size="sm" onClick={onOpenSimulator} className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Test Webhooks</span>
            <span className="sm:hidden">Webhooks</span>
          </Button>
        )}
      </div>
    </header>
  );
}
