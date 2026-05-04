"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ClipboardList, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);

  // 未読通知数の取得
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch {
      // エラー時は無視
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();

    if (!user) return;

    // リアルタイムで通知の変更を監視
    const channel = supabase
      .channel('bottom-nav-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  // おしらせページに移動した時にカウントをリフレッシュ
  useEffect(() => {
    if (pathname === "/notifications") {
      // 少し遅延させて既読処理を待つ
      const timer = setTimeout(fetchUnreadCount, 1000);
      return () => clearTimeout(timer);
    }
  }, [pathname, fetchUnreadCount]);

  // チャットページでは非表示
  if (pathname?.startsWith("/chat/")) {
    return null;
  }

  const navItems = [
    { href: "/", label: t("nav.home"), icon: Home },
    { href: "/notifications", label: t("nav.notifications"), icon: Bell, badge: unreadCount },
    { href: "/listing", label: t("nav.listing"), icon: Camera, special: true },
    { href: "/profile" , label: t("nav.mypage"), icon: User },
    { href: "/transactions", label: t("nav.schedule"), icon: ClipboardList },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 z-50 safe-area-bottom shadow-[0_-10px_32px_rgba(15,23,42,0.14)] [.hide-bottom-nav_&]:hidden">
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
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 -translate-y-4 bg-emerald-50 ring-4 ring-emerald-100",
                  isActive
                    ? "scale-110 shadow-emerald-100"
                    : "hover:bg-emerald-100 hover:scale-105 shadow-emerald-100"
                )}>
                  <Icon className={cn("w-8 h-8 transition-colors", isActive ? "text-primary" : "text-gray-400")} strokeWidth={2.5} />
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
                "flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all duration-200 relative",
                isActive
                  ? "text-primary translate-y-[-2px]"
                  : "text-gray-400 hover:text-primary/70"
              )}
            >
              <div className="relative">
                <Icon 
                  className={cn("w-6 h-6 transition-all", isActive ? "scale-110" : "")} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                {/* 未読バッジ */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-in zoom-in-50 duration-200">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
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
