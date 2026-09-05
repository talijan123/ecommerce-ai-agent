"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Bot, Loader2, ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : "/login";
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4">
        <div className="relative flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl gradient-blue-indigo flex items-center justify-center text-white shadow-xl shadow-indigo-500/25 animate-pulse">
              <Bot className="h-8 w-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 rounded-full p-1 shadow">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white">Authenticating Merchant Session</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Verifying your access credentials and loading merchant workspace...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="glass-card rounded-2xl p-6 max-w-md text-center border border-amber-500/20 shadow-xl">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white">Authentication Required</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
            You must be signed in to access the merchant dashboard. Redirecting to login...
          </p>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-500" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
