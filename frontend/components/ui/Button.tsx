import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "gradient" | "subtle";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.97]";

    const variantStyles = {
      primary:
        "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-600/30 hover:shadow-md hover:shadow-blue-600/40 border border-blue-500/30",
      secondary:
        "bg-zinc-100 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/80 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700",
      subtle:
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/30",
      outline:
        "border border-zinc-200 dark:border-zinc-800 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700",
      ghost:
        "hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white",
      destructive:
        "bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/30 border border-rose-500/30",
      gradient:
        "gradient-blue-indigo text-white hover:opacity-95 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 border border-indigo-400/30",
    };

    const sizeStyles = {
      xs: "h-7 px-2.5 text-[11px] rounded-lg gap-1",
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-9.5 px-4 text-xs font-semibold rounded-xl gap-2",
      lg: "h-11 px-5 text-sm font-semibold rounded-xl gap-2.5",
      icon: "h-9 w-9 rounded-xl p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
