import React from "react";
import { LucideIcon } from "lucide-react";
import { Card } from "@/lib/ui";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: "blue" | "emerald" | "amber" | "indigo" | "rose";
}

export function MetricsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp = true,
  color = "blue",
}: MetricsCardProps) {
  const colorMap = {
    blue: {
      bg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      glow: "hover:border-blue-500/40 hover:shadow-blue-500/5",
    },
    emerald: {
      bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      glow: "hover:border-emerald-500/40 hover:shadow-emerald-500/5",
    },
    amber: {
      bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      glow: "hover:border-amber-500/40 hover:shadow-amber-500/5",
    },
    indigo: {
      bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      glow: "hover:border-indigo-500/40 hover:shadow-indigo-500/5",
    },
    rose: {
      bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      glow: "hover:border-rose-500/40 hover:shadow-rose-500/5",
    },
  };

  return (
    <Card
      className={cn(
        "p-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 transition-all duration-300 relative overflow-hidden group hover:shadow-xl",
        colorMap[color].glow
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight">{value}</h3>
        </div>
        <div className={cn("p-2.5 rounded-xl border shrink-0", colorMap[color].bg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3.5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
        <span className="text-[11px] truncate mr-2">{description}</span>
        {trend && (
          <span
            className={cn(
              "font-mono font-bold px-2 py-0.5 rounded-md text-[10px] shrink-0",
              trendUp ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/15 text-rose-400 border border-rose-500/20"
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}
