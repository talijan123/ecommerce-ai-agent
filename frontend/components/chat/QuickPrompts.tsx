import React from "react";
import { Package, Search, ShoppingBag, Globe } from "lucide-react";

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
      label: "White T-Shirt in Size L",
      prompt: "Do you have the Classic White T-Shirt in size L?",
      icon: Search,
    },
    {
      label: "Roman Urdu (Order 1043)",
      prompt: "Mera order 1043 kab deliver hoga?",
      icon: Globe,
    },
    {
      label: "Cart Discount (Sarah)",
      prompt: "Can I get a discount code for my abandoned cart? My email is sarah.smith@example.com",
      icon: ShoppingBag,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 no-scrollbar">
      {prompts.map((p, idx) => {
        const Icon = p.icon;
        return (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onSelectPrompt(p.prompt)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:border-blue-500/40 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50 active:scale-95 shrink-0"
          >
            <Icon className="h-3 w-3 text-blue-400" />
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
