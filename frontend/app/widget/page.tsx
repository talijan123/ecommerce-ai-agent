"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Bot } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Badge, Button } from "@/lib/ui";

export default function StandaloneWidgetPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-6 sm:p-12">
      {/* Top Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8">
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Storefront
          </Button>
        </Link>
        <Badge variant="indigo" className="gap-1.5 py-1 px-3">
          <Sparkles className="h-3.5 w-3.5" />
          Embeddable Widget Mode
        </Badge>
      </div>

      {/* Standalone Interactive Widget */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-6 space-y-1.5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Standalone Customer Chat Widget</h1>
          <p className="text-xs text-slate-400">
            Interactive preview of the embeddable chatbot widget running in containerized mode.
          </p>
        </div>

        <ChatWidget standalone={true} />
      </div>
    </div>
  );
}
