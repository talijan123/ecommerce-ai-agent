"use client";

import React from "react";
import { MessageSquare, Package, ShoppingCart, CheckCircle2, Clock, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/lib/ui";
import { formatDate } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "order" | "inventory" | "chat" | "discount";
  title: string;
  description: string;
  time: string;
  status: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  // Default mock activities if no live items are passed
  const items: ActivityItem[] = activities || [
    {
      id: "act-1",
      type: "order",
      title: "Order Status Lookup",
      description: "AI retrieved real-time FedEx tracking for Order #1042 (Hamza Tariq)",
      time: new Date().toISOString(),
      status: "Resolved",
    },
    {
      id: "act-2",
      type: "inventory",
      title: "Out-of-Stock Size Suggestion",
      description: "Customer requested Classic White T-Shirt in Size L. AI offered Sizes S, M, XL.",
      time: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      status: "Resolved",
    },
    {
      id: "act-3",
      type: "chat",
      title: "Roman Urdu Query Parsed",
      description: "Answered 'Mera order 1043 kab deliver hoga?' in Roman Urdu (ETA Tomorrow via DHL)",
      time: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      status: "Resolved",
    },
    {
      id: "act-4",
      type: "discount",
      title: "Cart Recovery Promo Issued",
      description: "Issued discount code SAVE15 (15% off) for abandoned cart (sarah.smith@example.com)",
      time: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      status: "Recovered",
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4 text-blue-400" />;
      case "inventory":
        return <Zap className="h-4 w-4 text-amber-400" />;
      case "discount":
        return <ShoppingCart className="h-4 w-4 text-emerald-400" />;
      default:
        return <MessageSquare className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <Card className="h-full flex flex-col border-zinc-800/80 bg-zinc-900/60 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800/80">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
          <Clock className="h-4 w-4 text-blue-400" />
          Live Autonomous AI Activity Feed
        </CardTitle>
        <Badge variant="success" dot={true}>Real-time Stream</Badge>
      </CardHeader>

      <CardContent className="pt-4 space-y-3 flex-1 overflow-y-auto max-h-[420px] custom-scrollbar">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 hover:bg-zinc-800/40 transition-all flex items-start gap-3"
          >
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 mt-0.5 shadow-sm">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">{formatDate(item.time)}</span>
              </div>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{item.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={item.status === "Recovered" ? "success" : "indigo"} className="text-[10px]">
                  <CheckCircle2 className="h-3 w-3" />
                  {item.status}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
