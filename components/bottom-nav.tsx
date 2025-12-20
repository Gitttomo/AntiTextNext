"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  // チャットページでは非表示
  if (pathname?.startsWith("/chat/")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-100 to-blue-200 border-t border-gray-300 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-20 max-w-screen-lg mx-auto">
        <Link
          href="/"
          prefetch={true}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200",
            pathname === "/"
              ? "text-primary scale-105"
              : "text-gray-500 hover:text-primary/70"
          )}
        >
          <Home className="w-7 h-7" strokeWidth={pathname === "/" ? 2.5 : 2} />
          <span className="text-xs font-medium">ホーム</span>
        </Link>

        <Link
          href="/listing"
          prefetch={true}
          className="flex flex-col items-center justify-center -mt-6"
        >
          <div className={cn(
            "w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
            pathname === "/listing"
              ? "scale-110 shadow-primary/40 shadow-xl"
              : "hover:scale-105 hover:shadow-xl"
          )}>
            <Camera className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <span className={cn(
            "text-xs font-medium mt-1 transition-colors",
            pathname === "/listing" ? "text-primary" : "text-gray-500"
          )}>出品</span>
        </Link>

        <Link
          href="/transactions"
          prefetch={true}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200",
            pathname?.startsWith("/transactions")
              ? "text-primary scale-105"
              : "text-gray-500 hover:text-primary/70"
          )}
        >
          <ClipboardList
            className="w-7 h-7"
            strokeWidth={pathname?.startsWith("/transactions") ? 2.5 : 2}
          />
          <span className="text-xs font-medium">取引一覧</span>
        </Link>
      </div>
    </nav>
  );
}
