"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  showDropdown?: boolean;
}

export function ThemeToggle({ className = "", showDropdown = false }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme, isMounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Prevent SSR hydration mismatch
  if (!isMounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className={`relative p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 transition-all ${className}`}
      >
        <div className="h-4 w-4" />
      </button>
    );
  }

  if (!showDropdown) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
        title={`Current theme: ${theme} (${resolvedTheme}). Click to toggle.`}
        className={`relative p-2 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-100/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/40 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/80 transition-all active:scale-95 shadow-sm ${className}`}
      >
        <span className="sr-only">Toggle theme</span>
        <div className="relative h-4 w-4 flex items-center justify-center">
          <Sun
            className={`h-4 w-4 text-amber-500 transition-all duration-300 transform ${
              resolvedTheme === "dark"
                ? "rotate-90 scale-0 opacity-0 absolute"
                : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <Moon
            className={`h-4 w-4 text-indigo-400 transition-all duration-300 transform ${
              resolvedTheme === "dark"
                ? "rotate-0 scale-100 opacity-100"
                : "-rotate-90 scale-0 opacity-0 absolute"
            }`}
          />
        </div>
      </button>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select theme"
        aria-expanded={isOpen}
        className="p-2 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-zinc-100/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:border-blue-500/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all active:scale-95 shadow-sm flex items-center gap-1.5 text-xs font-medium"
      >
        <div className="relative h-4 w-4 flex items-center justify-center">
          {resolvedTheme === "dark" ? (
            <Moon className="h-4 w-4 text-indigo-400" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-1.5 shadow-xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              theme === "light"
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              Light
            </span>
            {theme === "light" && <Check className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              theme === "dark"
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              Dark
            </span>
            {theme === "dark" && <Check className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              theme === "system"
                ? "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2">
              <Laptop className="h-3.5 w-3.5 text-zinc-400" />
              System
            </span>
            {theme === "system" && <Check className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
