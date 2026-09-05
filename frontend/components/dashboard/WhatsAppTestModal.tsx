"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  MessageSquare,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Button } from "@/lib/ui";

interface WhatsAppTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  phoneNumberId?: string;
  storeId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
}

import {
  DEFAULT_WHATSAPP_PHONE,
  DEFAULT_WHATSAPP_CLEAN_PHONE,
  getSandboxConnectUrl,
} from "@/lib/api";

export function WhatsAppTestModal({
  isOpen,
  onClose,
  storeName,
  phoneNumberId,
  storeId,
  displayPhoneNumber,
  verifiedName,
}: WhatsAppTestModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const isCustomVerified =
    phoneNumberId &&
    !phoneNumberId.startsWith("pending-") &&
    displayPhoneNumber;

  const connectCommand = `CONNECT ${storeId || ""}`;
  const sandboxConnectUrl = getSandboxConnectUrl(storeId || "");

  // Clean phone number for wa.me link
  const targetNumber = (displayPhoneNumber || phoneNumberId || "").replace(/[^0-9]/g, "");
  const defaultMessage = `Hi! I would like to ask about products and track my orders at ${storeName}.`;
  
  const whatsappUrl = isCustomVerified && targetNumber
    ? `https://wa.me/${targetNumber}?text=${encodeURIComponent(defaultMessage)}`
    : sandboxConnectUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(whatsappUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(connectCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card w-full max-w-md rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative bg-white dark:bg-zinc-950">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/20">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Test Autonomous AI on WhatsApp
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Scan the QR code with your mobile camera to chat live with your agent
          </p>
        </div>

        {/* Store & Meta Details Pill */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
              {isCustomVerified ? "Store Profile" : "Instant Sandbox Store"}
            </span>
            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate block">
              {verifiedName || storeName}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${
            isCustomVerified
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          }`}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{isCustomVerified ? "Custom Meta API" : "Instant Sandbox"}</span>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-inner flex flex-col items-center justify-center mb-4">
          <div className="p-3 bg-white rounded-xl shadow-md border border-zinc-100">
            <QRCodeSVG
              value={whatsappUrl}
              size={170}
              level="M"
              includeMargin={false}
              fgColor="#0f172a"
            />
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-3 flex items-center gap-1.5 font-medium text-center">
            <Smartphone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            {isCustomVerified
              ? "Point camera or WhatsApp QR scanner to start chat"
              : "Scan QR code or click below to pair via WhatsApp"}
          </span>
        </div>

        {/* Instant Sandbox Connect Code Box (if sandbox mode) */}
        {!isCustomVerified && storeId && (
          <div className="p-2.5 rounded-xl bg-zinc-900 text-zinc-200 mb-4 border border-zinc-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] text-zinc-400 font-mono block">Sandbox Pair Command:</span>
              <span className="text-xs font-mono font-bold text-emerald-400 truncate block">
                {connectCommand}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyCommand}
              className="shrink-0 gap-1 text-[11px] py-1 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
            >
              {copiedCmd ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Direct Link Action */}
        <div className="space-y-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition-all"
          >
            <ExternalLink className="h-4 w-4" />
            <span>{isCustomVerified ? "Open in WhatsApp Web / App" : "Launch WhatsApp Sandbox Demo"}</span>
          </a>

          <Button
            variant="outline"
            size="md"
            onClick={handleCopyLink}
            className="w-full gap-2 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span>Link Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Direct WhatsApp Link</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
