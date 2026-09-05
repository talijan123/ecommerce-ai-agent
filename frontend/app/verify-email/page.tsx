"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Mail,
  KeyRound,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ClipboardPaste,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Pre-fill from query parameters
  useEffect(() => {
    const emailParam = searchParams.get("email");
    const tokenParam = searchParams.get("token");

    if (emailParam) setEmail(emailParam);
    if (tokenParam) setToken(tokenParam);
  }, [searchParams]);

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setToken(text.trim());
      }
    } catch {
      // ignore clipboard permission rejection
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    const cleanToken = token.trim();

    if (!cleanEmail || !cleanToken) {
      setErrorMsg("Please provide both your registered email and verification token.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await verifyEmail({
        email: cleanEmail,
        verification_token: cleanToken,
      });

      setIsSuccess(true);
      setSuccessMessage(res.message || "Email verified successfully! You can now log in.");

      // Fire celebratory confetti!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#3b82f6", "#6366f1", "#10b981", "#ec4899"],
        });
      } catch {
        // Confetti fallback
      }

      // Auto redirect to login after short celebratory delay
      setTimeout(() => {
        router.push(`/login?verified=true&email=${encodeURIComponent(cleanEmail)}`);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(formatApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-xl">
      {/* Success Banner */}
      {isSuccess ? (
        <div className="text-center py-4 space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Account Verified!</h3>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {successMessage}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={`/login?verified=true&email=${encodeURIComponent(email)}`}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 transition-all"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-start gap-3 animate-shake">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-sm">Verification Failed</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Registered Merchant Email
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

            {/* Verification Token Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Verification Token / Code
                </label>
                <button
                  type="button"
                  onClick={handlePasteToken}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  <span>Paste Token</span>
                </button>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Paste your verification token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isSubmitting}
                  className="block w-full pl-10 pr-4 py-2.5 font-mono text-xs sm:text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Enter the token generated during account registration.
              </p>
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
                    <span>Verifying Token...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Verify & Activate Account</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Secondary Footer */}
          <div className="mt-6 pt-5 border-t border-zinc-200/80 dark:border-zinc-800/80 text-center space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Already verified?{" "}
              <Link
                href="/login"
                className="font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors"
              >
                Sign In to Dashboard
              </Link>
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Need a new account?{" "}
              <Link
                href="/signup"
                className="text-zinc-600 dark:text-zinc-400 underline hover:text-zinc-900 dark:hover:text-white"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
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
          Verify Merchant Email
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Confirm your account email to unlock your multi-tenant store dashboard
        </p>
      </div>

      {/* Main Card with Suspense for SearchParams */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Suspense
          fallback={
            <div className="glass-card rounded-2xl p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs text-zinc-400">Loading verification parameters...</p>
            </div>
          }
        >
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
