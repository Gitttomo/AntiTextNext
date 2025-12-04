import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { AuthProvider } from "@/components/auth-provider";

const inter = Inter({ subsets: ["latin"] });

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
