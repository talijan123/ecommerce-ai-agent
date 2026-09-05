import React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string | { value: string; isPositive?: boolean };
  trendUp?: boolean;
  color?: "blue" | "emerald" | "amber" | "indigo" | "rose" | "purple";
  accentColor?: "blue" | "emerald" | "amber" | "indigo" | "rose" | "purple";
  onClick?: () => void;
}

export function MetricsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp = true,
  color,
  accentColor = "blue",
  onClick,
}: MetricsCardProps) {
  const chosenColor = color || accentColor || "blue";

  const colorMap: Record<string, { bg: string; glow: string }> = {
    blue: {
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      glow: "hover:border-blue-500/40 hover:shadow-blue-500/10",
    },
    emerald: {
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      glow: "hover:border-emerald-500/40 hover:shadow-emerald-500/10",
    },
    amber: {
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      glow: "hover:border-amber-500/40 hover:shadow-amber-500/10",
    },
    indigo: {
      bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      glow: "hover:border-indigo-500/40 hover:shadow-indigo-500/10",
    },
    purple: {
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      glow: "hover:border-purple-500/40 hover:shadow-purple-500/10",
    },
    rose: {
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      glow: "hover:border-rose-500/40 hover:shadow-rose-500/10",
    },
  };

  const styling = colorMap[chosenColor] || colorMap.blue;

  const trendText = typeof trend === "object" && trend !== null ? trend.value : trend;
  const isPositiveTrend =
    typeof trend === "object" && trend !== null
      ? trend.isPositive ?? true
      : trendUp;

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/60 shadow-sm transition-all duration-200 relative overflow-hidden group hover:shadow-md",
        onClick ? "cursor-pointer" : "",
        styling.glow
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-900 dark:text-white mt-1 tracking-tight truncate">
            {value}
          </h3>
        </div>
        <div className={cn("p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105 duration-200 shadow-sm", styling.bg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {(description || trendText) && (
        <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 gap-2">
          <span className="text-[11px] truncate flex-1">{description || "Real-time sync"}</span>
          {trendText && (
            <span
              className={cn(
                "font-mono font-bold px-2 py-0.5 rounded-md text-[10px] shrink-0",
                isPositiveTrend
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
              )}
            >
              {trendText}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
