"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isMounted: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => null,
  toggleTheme: () => null,
  isMounted: false,
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "autocommerce_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [isMounted, setIsMounted] = useState(false);

  // Apply theme to document element
  const applyTheme = (targetTheme: Theme) => {
    const root = document.documentElement;
    let effectiveTheme: "light" | "dark" = "dark";

    if (targetTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveTheme = prefersDark ? "dark" : "light";
    } else {
      effectiveTheme = targetTheme;
    }

    if (effectiveTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }

    setResolvedTheme(effectiveTheme);
  };

  // Initialize theme from localStorage or system preference on mount
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initialTheme: Theme = saved && ["light", "dark", "system"].includes(saved) ? saved : "dark";
    setThemeState(initialTheme);
    applyTheme(initialTheme);

    // Listen to system color scheme changes if system preference is selected
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMediaChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
      if (current === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, isMounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
