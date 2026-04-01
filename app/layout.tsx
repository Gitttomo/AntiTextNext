import type { Metadata } from "next";
import { Inter } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";

// BottomNavを遅延読み込み（初期表示を高速化）
const BottomNav = dynamic(() => import("@/components/bottom-nav").then(mod => ({ default: mod.BottomNav })), {
  ssr: false,
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // フォント読み込み中もテキスト表示
  preload: true,
});

export const metadata: Metadata = {
  title: "TextNext - 学内教科書フリマ",
  description: "学内限定で教科書が循環するC2Cフリマアプリ",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TextNext",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://qbmxbkylelaixoxupfeq.supabase.co" />
        <link rel="dns-prefetch" href="https://qbmxbkylelaixoxupfeq.supabase.co" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <main className="min-h-screen pb-24">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
