"use client";

import React, { useState } from "react";
import {
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronUp,
  Package,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolInvocationLog } from "@/lib/api";
import { Badge } from "@/lib/ui";

export interface MessageItem {
  id?: string | number;
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  tools_invoked?: ToolInvocationLog[];
  created_at?: string;
  suggested_actions?: string[];
}

interface ChatMessageProps {
  message: MessageItem;
  onSelectAction?: (actionText: string) => void;
}

export function ChatMessage({ message, onSelectAction }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [showTools, setShowTools] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Helper to render basic markdown formatting (bold, code blocks, bullet points, headers)
  const renderFormattedContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Check for promo codes like SAVE15, DISCOUNT10, etc.
      const promoMatch = line.match(/\b(SAVE\d+|DISCOUNT\d+|WELCOME\d+|CART\d+)\b/i);

      // Render bullet point
      if (line.trim().startsWith("•") || line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const cleanLine = line.replace(/^[\s•*-]+/, "").trim();
        return (
          <li key={idx} className="ml-4 list-disc text-zinc-300 my-0.5">
            {formatInlineText(cleanLine)}
          </li>
        );
      }

      // Render numbered list
      if (/^\d+\.\s/.test(line.trim())) {
        const cleanLine = line.replace(/^\d+\.\s*/, "").trim();
        return (
          <li key={idx} className="ml-4 list-decimal text-zinc-300 my-0.5">
            {formatInlineText(cleanLine)}
          </li>
        );
      }

      // Render line with inline formatting
      return (
        <p key={idx} className={cn("my-1", line.trim() === "" ? "h-2" : "")}>
          {formatInlineText(line)}
          {promoMatch && !isUser && (
            <span className="inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold">
              <span>{promoMatch[0]}</span>
              <button
                onClick={() => handleCopy(promoMatch[0])}
                className="hover:text-white transition-colors p-0.5 rounded hover:bg-emerald-500/20"
                title="Copy promo code"
              >
                {copiedCode === promoMatch[0] ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </span>
          )}
        </p>
      );
    });
  };

  const formatInlineText = (str: string) => {
    // Basic regex replacer for **bold** and `code`
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-zinc-800 text-blue-300 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div
      className={cn(
        "flex gap-3 py-1.5 text-xs leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "h-7 w-7 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm transition-transform duration-200",
          isUser
            ? "bg-zinc-800 border border-zinc-700/80"
            : "gradient-blue-indigo shadow-blue-500/20 border border-indigo-400/30"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5 text-zinc-300" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Message Content Container */}
      <div className={cn("max-w-[85%] space-y-2", isUser ? "items-end" : "items-start")}>
        {/* Tool Invocations Badge if any tools were executed */}
        {message.tools_invoked && message.tools_invoked.length > 0 && (
          <div className="space-y-1.5 w-full">
            {message.tools_invoked.map((tool, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/90 text-[11px] overflow-hidden shadow-sm backdrop-blur-md"
              >
                <button
                  onClick={() => setShowTools(!showTools)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Wrench className="h-3 w-3 text-blue-400" />
                    <span>Tool Invoked:</span>
                    <span className="font-semibold text-white">{formatToolName(tool.tool_name)}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ml-1 animate-pulse" />
                  </div>
                  {showTools ? <ChevronUp className="h-3 w-3 text-zinc-400" /> : <ChevronDown className="h-3 w-3 text-zinc-400" />}
                </button>

                {showTools && (
                  <div className="p-3 bg-zinc-950/90 border-t border-zinc-800/80 font-mono text-[10px] space-y-2 text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block mb-1 font-semibold uppercase tracking-wider text-[9px]">Input Parameters:</span>
                      <pre className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto text-blue-300">
                        {JSON.stringify(tool.arguments, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-zinc-500 block mb-1 font-semibold uppercase tracking-wider text-[9px]">Database Response:</span>
                      <pre className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-x-auto text-emerald-300 max-h-36">
                        {JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Product Cards for Inventory Tools */}
        {message.tools_invoked &&
          message.tools_invoked
            .filter((t) => (t.tool_name === "check_product_inventory" || t.tool_name === "check_product_stock") && t.result && !t.result.error)
            .map((t, tIdx) => {
              const res = t.result;
              const items = Array.isArray(res) ? res : res.products ? res.products : [res];
              return (
                <div key={tIdx} className="grid grid-cols-1 gap-2 pt-1">
                  {items.slice(0, 2).map((item: any, iIdx: number) => {
                    const title = item.name || item.title || "Product";
                    const price = item.price ? `$${Number(item.price).toFixed(2)}` : null;
                    const stock = item.stock_quantity ?? item.stock_count ?? item.stock ?? 0;
                    const inStock = item.in_stock !== false && stock > 0;
                    const img = item.image_url || item.thumbnail || (item.images && item.images[0]?.src);

                    return (
                      <div
                        key={iIdx}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-md backdrop-blur-md"
                      >
                        {img ? (
                          <img src={img} alt={title} className="w-12 h-12 rounded-lg object-cover bg-zinc-950 border border-zinc-800" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-indigo-950/50 border border-indigo-800/40 flex items-center justify-center text-indigo-400">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{title}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {price && <span className="text-xs font-extrabold text-emerald-400">{price}</span>}
                            <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-medium", inStock ? "bg-emerald-950 text-emerald-300 border border-emerald-800" : "bg-red-950 text-red-300 border border-red-800")}>
                              {inStock ? `In Stock (${stock})` : "Out of Stock"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => onSelectAction ? onSelectAction(`I would like to order ${title}`) : null}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] shrink-0 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <span>Buy Now</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

        {/* Text Message Bubble */}
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 leading-relaxed shadow-sm transition-all",
              isUser
                ? "rounded-tr-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-indigo-600/20 font-medium"
                : "rounded-tl-xs bg-zinc-900/90 border border-zinc-800/80 text-zinc-200 backdrop-blur-md"
            )}
          >
            {renderFormattedContent(message.content)}
          </div>
        )}


        {/* Timestamp */}
        {message.created_at && (
          <div className={cn("text-[10px] text-zinc-500 flex items-center gap-1 px-1", isUser ? "justify-end" : "justify-start")}>
            <Clock className="h-2.5 w-2.5" />
            <span>
              {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
