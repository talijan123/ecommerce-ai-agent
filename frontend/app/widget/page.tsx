"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bot } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Badge, Button } from "@/lib/ui";

export default function StandaloneWidgetPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 sm:p-10 bg-grid-pattern">
      {/* Top Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-6">
        <Link href="/">
          <Button variant="secondary" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Storefront
          </Button>
        </Link>
        <Badge variant="indigo" className="gap-1.5 py-1 px-3">
          <Sparkles className="h-3.5 w-3.5" />
          Embeddable Widget Preview
        </Badge>
      </div>

      {/* Standalone Interactive Widget */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-6 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Standalone Customer Chat Widget</h1>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Live preview of the embeddable AI assistant running in isolated container mode with full tool-calling support.
          </p>
        </div>

        <ChatWidget standalone={true} />
      </div>
    </div>
  );
}
