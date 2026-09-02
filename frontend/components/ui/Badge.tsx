import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" | "indigo" | "violet" | "emerald";
  dot?: boolean;
}

export function Badge({ className, variant = "default", dot = false, children, ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    secondary: "bg-zinc-800/80 text-zinc-300 border-zinc-700/80",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    destructive: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    outline: "border-zinc-800 text-zinc-400 bg-transparent",
  };

  const dotColors = {
    default: "bg-blue-400",
    secondary: "bg-zinc-400",
    success: "bg-emerald-400",
    emerald: "bg-emerald-400",
    warning: "bg-amber-400",
    destructive: "bg-rose-400",
    indigo: "bg-indigo-400",
    violet: "bg-violet-400",
    outline: "bg-zinc-400",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotColors[variant])} />}
      {children}
    </div>
  );
}
