import type { Metadata } from "next";
import { Inter, M_PLUS_Rounded_1c } from "next/font/google";
import dynamic from "next/dynamic";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Providers } from "@/components/providers";
import LegalFooter from "@/components/legal-footer";
import TrialNoticeBanner from "@/components/trial-notice-banner";
import SwipeTabNavigation from "@/components/swipe-tab-navigation";
import NavigationLoadingOverlay from "@/components/navigation-loading-overlay";

// BottomNavを遅延読み込み（初期表示を高速化）
const BottomNav = dynamic(() => import("@/components/bottom-nav").then(mod => ({ default: mod.BottomNav })), {
  ssr: false,
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

const mplusRounded = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  preload: true,
  variable: "--font-mplus-rounded",
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
      <body className={`${inter.variable} ${mplusRounded.variable} ${inter.className}`}>
        <Providers>
          <AuthProvider>
            <TrialNoticeBanner />
            <SwipeTabNavigation />
            <NavigationLoadingOverlay />
            <main className="min-h-screen pb-24">{children}</main>
            <LegalFooter />
            <BottomNav />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
