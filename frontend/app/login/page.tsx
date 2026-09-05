"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Store,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isNotVerified, setIsNotVerified] = useState(false);
  const [justVerified, setJustVerified] = useState(false);

  // Read search params
  useEffect(() => {
    const emailParam = searchParams.get("email");
    const verifiedParam = searchParams.get("verified");

    if (emailParam) setEmail(emailParam);
    if (verifiedParam === "true") setJustVerified(true);
  }, [searchParams]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const redirectUrl = searchParams.get("redirect") || "/dashboard";
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsNotVerified(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg("Please enter both your email address and password.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        email: cleanEmail,
        password,
      });

      const redirectUrl = searchParams.get("redirect") || "/dashboard";
      router.push(redirectUrl);
    } catch (err: any) {
      const status = err?.response?.status;
      const formatted = formatApiError(err);

      if (status === 403 || formatted.toLowerCase().includes("not verified")) {
        setIsNotVerified(true);
        setErrorMsg("Your email is not verified yet. Please verify your email before logging in.");
      } else {
        setErrorMsg(formatted || "Invalid email or password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-xl">
      {/* Verified Banner */}
      {justVerified && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-sm">Email Verified Successfully!</p>
            <p className="mt-0.5">Please sign in with your credentials to enter your merchant portal.</p>
          </div>
        </div>
      )}

      {/* Error / Not Verified Banner */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-start gap-3 animate-shake">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5 flex-1">
            <p className="font-bold text-sm">Sign In Error</p>
            <p>{errorMsg}</p>
            {isNotVerified && (
              <div className="pt-1">
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email)}`}
                  className="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-zinc-700"
                >
                  <span>Verify Email Token Now</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Merchant Email Address
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              required
              placeholder="merchant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="block w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Account Password
            </label>
            <Link
              href="/verify-email"
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              Verify Token?
            </Link>
          </div>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="block w-full pl-10 pr-10 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white gradient-blue-indigo hover:opacity-95 shadow-lg shadow-indigo-500/25 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Secondary Footer */}
      <div className="mt-6 pt-5 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center space-y-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Don&apos;t have a merchant account?{" "}
          <Link
            href="/signup"
            className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
          >
            Create account
          </Link>
        </p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          Want to explore the public store?{" "}
          <Link
            href="/"
            className="text-zinc-600 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-white"
          >
            Go to Storefront
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-radial-gradient pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2.5 group mb-4">
          <div className="h-10 w-10 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Bot className="h-5 w-5" />
          </div>
          <span className="font-black text-xl tracking-tight text-zinc-900 dark:text-white">
            AutoCommerce<span className="text-blue-600">.ai</span>
          </span>
        </Link>
        <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Merchant Sign In
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Access your autonomous WhatsApp AI agent, stores, and order analytics
        </p>
      </div>

      {/* Main Form wrapped in Suspense for SearchParams */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense
          fallback={
            <div className="glass-card rounded-2xl p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs text-zinc-400">Loading sign in options...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
