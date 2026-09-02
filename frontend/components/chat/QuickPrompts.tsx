import React from "react";
import { Package, Search, Tag, Globe, Sparkles, Footprints, Headphones } from "lucide-react";

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  const prompts = [
    {
      label: "Track Order #1042",
      prompt: "Where is my order #1042?",
      icon: Package,
    },
    {
      label: "White T-Shirt in Size L?",
      prompt: "Do you have the Classic White T-Shirt in size L?",
      icon: Search,
    },
    {
      label: "Cart Promo (Sarah)",
      prompt: "Can I get a discount code for my abandoned cart? My email is sarah.smith@example.com",
      icon: Tag,
    },
    {
      label: "Under $60 Apparel",
      prompt: "Show me all apparel items under $60 with available stock.",
      icon: Sparkles,
    },
    {
      label: "Roman Urdu (Order 1043)",
      prompt: "Mera order #1043 kab deliver hoga?",
      icon: Globe,
    },
    {
      label: "Noise Canceling Headphones",
      prompt: "What are the specs and battery life of the wireless headphones?",
      icon: Headphones,
    },
  ];

  return (
    <div className="relative py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 no-scrollbar scroll-smooth">
        {prompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => onSelectPrompt(p.prompt)}
              className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-800/90 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-blue-500/40 hover:bg-zinc-800 hover:text-white transition-all duration-200 disabled:opacity-50 active:scale-95 shrink-0 shadow-sm"
            >
              <Icon className="h-3 w-3 text-blue-400 group-hover:text-blue-300 transition-colors" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
