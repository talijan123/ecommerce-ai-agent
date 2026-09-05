"use client";

import React, { useState } from "react";
import {
  LifeBuoy,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  HelpCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/lib/ui";
import { api, formatApiError } from "@/lib/api";

interface SupportTicketModalProps {
  isOpen: boolean;
  storeId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SupportTicketModal({
  isOpen,
  storeId,
  onClose,
  onSuccess,
}: SupportTicketModalProps) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    if (!subject.trim() || !description.trim()) {
      setErrorMsg("Please provide both a subject and details of your request.");
      return;
    }

    try {
      setLoading(true);
      await api.createSupportTicket({
        store_id: storeId || undefined,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });

      setSuccessInfo("Support ticket submitted! Platform engineering will triage your request promptly.");
      setTimeout(() => {
        setSubject("");
        setDescription("");
        setSuccessInfo(null);
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/70 dark:bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Contact Support & Report Issue
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Direct dispatch to AutoCommerce Platform Engineering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{successInfo}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Ticket Subject *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. WhatsApp Webhook delivery delay or CSV SKU parsing"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="general">General Inquiry</option>
                <option value="whatsapp">WhatsApp Cloud API & Sandbox</option>
                <option value="catalog">Catalog & Store Sync</option>
                <option value="billing">Billing & Subscription</option>
                <option value="bug">Technical Bug Report</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="low">Low (General question)</option>
                <option value="normal">Normal (Standard assistance)</option>
                <option value="high">High (Feature not working)</option>
                <option value="urgent">Urgent (Production blocked)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, error messages, or steps to reproduce..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl p-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <Button variant="secondary" size="sm" type="button" onClick={onClose} disabled={loading} className="min-h-[40px]">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white min-h-[40px] gap-2 shadow-lg shadow-blue-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Submit Ticket</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
