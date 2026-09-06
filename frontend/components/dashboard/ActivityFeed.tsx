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
  const items: ActivityItem[] = activities || [];

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4 text-blue-500" />;
      case "inventory":
        return <Zap className="h-4 w-4 text-amber-500" />;
      case "discount":
        return <ShoppingCart className="h-4 w-4 text-emerald-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    }
  };

  return (
    <Card className="h-full flex flex-col border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/60 shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800/80 p-4 sm:p-5">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
          <Clock className="h-4 w-4 text-blue-500" />
          Live Autonomous AI Activity Feed
        </CardTitle>
        <Badge variant={items.length > 0 ? "success" : "outline"} dot={items.length > 0}>
          {items.length > 0 ? "Real-time Stream" : "Awaiting Events"}
        </Badge>
      </CardHeader>

      <CardContent className="pt-4 p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto max-h-[420px] custom-scrollbar">
        {items.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <Clock className="h-6 w-6" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No Autonomous Activity Recorded Yet
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                When customers chat on WhatsApp, look up order tracking, or receive recovery offers, real-time events will stream here.
              </p>
            </div>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 transition-all flex items-start gap-3"
            >
              <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shrink-0 mt-0.5 shadow-sm">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{item.title}</h4>
                  <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">{formatDate(item.time)}</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">{item.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={item.status === "Recovered" ? "success" : "indigo"} className="text-[10px]">
                    <CheckCircle2 className="h-3 w-3" />
                    {item.status}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
