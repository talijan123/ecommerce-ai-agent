"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

interface BackToTopProps {
  threshold?: number;
  className?: string;
}

export function BackToTop({ threshold = 400, className = "" }: BackToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      title="Back to top"
      className={`fixed bottom-24 right-5 sm:bottom-24 sm:right-6 z-40 p-3 rounded-full border border-zinc-200/90 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl text-zinc-700 dark:text-zinc-200 shadow-xl hover:shadow-2xl hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 active:scale-95 transition-all duration-300 ease-out group ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-4 scale-75 pointer-events-none"
      } ${className}`}
    >
      <ArrowUp className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}

export default BackToTop;
