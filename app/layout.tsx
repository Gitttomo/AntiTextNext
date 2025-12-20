/**
 * アプリケーション共通レイアウト
 * 
 * Next.jsのRoot Layoutとして、すべてのページに適用される共通レイアウトを定義します。
 * 
 * 構成:
 * - AuthProvider: 認証状態管理
 * - メインコンテンツ領域
 * - BottomNav: 下部ナビゲーションバー
 * 
 * メタデータ（title, description）もここで設定されます。
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { AuthProvider } from "@/components/auth-provider";

// Google Fontsからインターフォントを読み込み
const inter = Inter({ subsets: ["latin"] });

// ページのメタデータ設定
export const metadata: Metadata = {
  title: "TextNext - 学内教科書フリマ",
  description: "学内限定で教科書が循環するC2Cフリマアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <main className="min-h-screen pb-24">{children}</main>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
