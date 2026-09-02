import React from "react";
import { Bot, Sparkles } from "lucide-react";

interface TypingIndicatorProps {
  statusText?: string;
}

export function TypingIndicator({ statusText = "AI Agent is querying store tools..." }: TypingIndicatorProps) {
  return (
    <div className="flex items-start gap-3 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="h-7 w-7 rounded-xl gradient-blue-indigo flex items-center justify-center text-white shadow-md shadow-blue-500/20 border border-indigo-400/30 shrink-0">
        <Bot className="h-3.5 w-3.5" />
      </div>

      <div className="rounded-2xl rounded-tl-xs bg-zinc-900/90 border border-zinc-800/80 px-4 py-3 text-xs text-zinc-300 flex items-center gap-3 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.32s]"></span>
          <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.16s]"></span>
          <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce"></span>
        </div>
        <span className="text-zinc-400 text-[11px] font-medium flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
          {statusText}
        </span>
      </div>
    </div>
  );
}
