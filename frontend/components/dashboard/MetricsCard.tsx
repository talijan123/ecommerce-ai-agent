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
      glow: "hover:border-blue-500/40",
    },
    emerald: {
      bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      glow: "hover:border-emerald-500/40",
    },
    amber: {
      bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      glow: "hover:border-amber-500/40",
    },
    indigo: {
      bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      glow: "hover:border-indigo-500/40",
    },
    rose: {
      bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      glow: "hover:border-rose-500/40",
    },
  };

  return (
    <Card
      className={cn(
        "p-6 transition-all duration-300 relative overflow-hidden group",
        colorMap[color].glow
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">{value}</h3>
        </div>
        <div className={cn("p-3 rounded-xl border", colorMap[color].bg)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{description}</span>
        {trend && (
          <span
            className={cn(
              "font-medium px-2 py-0.5 rounded-full text-[11px]",
              trendUp ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
            )}
          >
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}
