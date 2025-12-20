"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ClipboardList, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  // チャットページでは非表示
  if (pathname?.startsWith("/chat/")) {
    return null;
  }

  const navItems = [
    { href: "/", label: "ホーム", icon: Home },
    { href: "/notifications", label: "おしらせ", icon: Bell },
    { href: "/listing", label: "出品", icon: Camera, special: true },
    { href: "/profile", label: "マイページ", icon: User },
    { href: "/transactions", label: "予定", icon: ClipboardList },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      <div className="flex items-end justify-around h-20 max-w-screen-lg mx-auto px-2 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/" 
            ? pathname === "/" 
            : pathname?.startsWith(item.href);

          if (item.special) {
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className="flex flex-col items-center justify-center -mb-2"
              >
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 -translate-y-4",
                  isActive
                    ? "bg-primary scale-110 shadow-primary/40 ring-4 ring-primary/10"
                    : "bg-primary/90 hover:bg-primary hover:scale-105 shadow-primary/20"
                )}>
                  <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold -mt-3 transition-colors",
                  isActive ? "text-primary" : "text-gray-400"
                )}>{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200",
                isActive
                  ? "text-primary translate-y-[-2px]"
                  : "text-gray-400 hover:text-primary/70"
              )}
            >
              <Icon 
                className={cn("w-6 h-6 transition-all", isActive ? "scale-110" : "")} 
                strokeWidth={isActive ? 2.5 : 2} 
              />
              <span className={cn(
                "text-[10px] font-bold tracking-tight",
                isActive ? "text-primary" : "text-gray-400"
              )}>{item.label}</span>
              {isActive && (
                <div className="w-1 h-1 bg-primary rounded-full absolute bottom-2" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
