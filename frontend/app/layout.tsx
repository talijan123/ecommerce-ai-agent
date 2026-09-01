import type { Metadata } from "next";
import "./globals.css";
import { ChatWidget } from "@/components/chat/ChatWidget";

export const metadata: Metadata = {
  title: "AutoCommerce | Autonomous AI E-Commerce Platform",
  description: "Production-grade Autonomous E-Commerce AI Agent & Merchant Admin Dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-blue-500 selection:text-white">
        {children}
        {/* Floating Customer AI Chat Widget visible globally */}
        <ChatWidget />
      </body>
    </html>
  );
}
