import React from "react";
import { Bot, Sparkles } from "lucide-react";

interface TypingIndicatorProps {
  statusText?: string;
}

export function TypingIndicator({ statusText = "AI Agent is querying store tools..." }: TypingIndicatorProps) {
  return (
    <div className="flex items-start gap-3 py-2 animate-in fade-in duration-300">
      <div className="h-8 w-8 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
        <Bot className="h-4 w-4" />
      </div>

      <div className="rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 px-4 py-3 text-xs text-slate-300 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></span>
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce"></span>
        </div>
        <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-blue-400 animate-pulse" />
          {statusText}
        </span>
      </div>
    </div>
  );
}
