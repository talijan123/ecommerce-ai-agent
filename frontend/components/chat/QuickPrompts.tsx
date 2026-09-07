import React from "react";
import { Package, Search, Tag, Globe, Sparkles, Footprints, Headphones } from "lucide-react";

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPrompts({ onSelectPrompt, disabled }: QuickPromptsProps) {
  const prompts = [
    {
      label: "Track My Order",
      prompt: "Can you help me track my recent order?",
      icon: Package,
    },
    {
      label: "Check Product Stock",
      prompt: "Do you have items in stock right now?",
      icon: Search,
    },
    {
      label: "Help with Sizing",
      prompt: "Can you help me choose the right size and fit?",
      icon: Sparkles,
    },
    {
      label: "Cart Discount Promo",
      prompt: "Can I get a discount promo code for my cart?",
      icon: Tag,
    },
    {
      label: "Roman Urdu Support",
      prompt: "Mera order kab deliver hoga?",
      icon: Globe,
    },
    {
      label: "Shipping & Delivery",
      prompt: "What are your shipping rates and estimated delivery times?",
      icon: Package,
    },
  ];

  return (
    <div className="shrink-0 px-3 py-2 overflow-x-auto whitespace-nowrap">
      <div className="flex items-center gap-1.5 no-scrollbar scroll-smooth">
        {prompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => onSelectPrompt(p.prompt)}
              className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-800/90 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-blue-500/40 hover:bg-zinc-800 hover:text-white transition-all duration-200 disabled:opacity-50 active:scale-95 shrink-0 shadow-sm"
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
