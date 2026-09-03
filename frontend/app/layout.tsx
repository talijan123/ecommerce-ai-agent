import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { BackToTop } from "@/components/BackToTop";

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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('autocommerce_theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = saved || (prefersDark ? 'dark' : 'light');
                  if (theme === 'system') {
                    theme = prefersDark ? 'dark' : 'light';
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          {children}
          {/* Floating Smooth Back to Top Action Button */}
          <BackToTop />
          {/* Floating Customer AI Chat Widget visible globally */}
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
