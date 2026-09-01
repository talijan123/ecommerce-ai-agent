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
    <header className="h-20 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-xl px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {description ? <p className="text-xs text-slate-400 mt-0.5">{description}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        {/* Backend Status Indicator */}
        <Badge variant={isBackendHealthy ? "success" : isBackendHealthy === false ? "destructive" : "secondary"}>
          <Activity className="h-3 w-3" />
          {isBackendHealthy === null
            ? "Checking API..."
            : isBackendHealthy
            ? "API Online (:8000)"
            : "API Offline"}
        </Badge>

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        )}

        {onOpenSimulator && (
          <Button variant="gradient" size="sm" onClick={onOpenSimulator}>
            <Zap className="h-3.5 w-3.5" />
            Test Webhook Sync
          </Button>
        )}
      </div>
    </header>
  );
}
