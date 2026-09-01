"use client";

import React, { useState } from "react";
import { Bot, User, Wrench, ChevronDown, ChevronUp, CheckCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolInvocationLog } from "@/lib/api";

export interface MessageItem {
  id?: string | number;
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  tools_invoked?: ToolInvocationLog[];
  created_at?: string;
}

interface ChatMessageProps {
  message: MessageItem;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [showTools, setShowTools] = useState(false);

  // Tool name human readable labels
  const formatToolName = (name: string) => {
    switch (name) {
      case "get_order_status":
        return "Order Lookup Service";
      case "check_product_inventory":
        return "Product Inventory Service";
      case "apply_cart_recovery_discount":
        return "Cart Recovery Promo Service";
      default:
        return name;
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3 py-2 text-xs leading-relaxed animate-in fade-in duration-200",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm",
          isUser ? "bg-slate-700" : "gradient-blue-indigo shadow-blue-500/20"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content Container */}
      <div className={cn("max-w-[82%] space-y-2", isUser ? "items-end" : "items-start")}>
        {/* Tool Invocations Badge if any tools were executed */}
        {message.tools_invoked && message.tools_invoked.length > 0 && (
          <div className="space-y-1.5">
            {message.tools_invoked.map((tool, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-slate-900/90 text-[11px] overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setShowTools(!showTools)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Wrench className="h-3 w-3 text-blue-400" />
                    <span>Invoked: {formatToolName(tool.tool_name)}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ml-1"></span>
                  </div>
                  {showTools ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {showTools && (
                  <div className="p-2.5 bg-slate-950/80 border-t border-slate-800/80 font-mono text-[10px] space-y-1.5 text-slate-400">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Parameters:</span>
                      <pre className="p-1.5 rounded-lg bg-slate-900 overflow-x-auto text-blue-300">
                        {JSON.stringify(tool.arguments, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Database Result:</span>
                      <pre className="p-1.5 rounded-lg bg-slate-900 overflow-x-auto text-emerald-300 max-h-32">
                        {JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Text Message Bubble */}
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 whitespace-pre-wrap leading-relaxed shadow-sm",
              isUser
                ? "rounded-tr-sm bg-blue-600 text-white"
                : "rounded-tl-sm bg-slate-900 border border-slate-800/80 text-slate-200"
            )}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
}
