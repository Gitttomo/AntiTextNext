"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, ClipboardList, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: 'exact', head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  }, [user]);

  const fetchUnreadNotificationCount = useCallback(async () => {
    if (!user) return;
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!error && count !== null) {
        setUnreadNotificationCount(count);
      }
    } catch (err) {
      console.error("Error fetching unread notification count:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();
    fetchUnreadNotificationCount();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Subscribe to new notifications
    const notificationsChannel = supabase
      .channel('unread-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUnreadNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, fetchUnreadCount, fetchUnreadNotificationCount]);

  // チャットページでは非表示
  if (pathname?.startsWith("/chat/")) {
    return null;
  }

  const navItems = [
    { href: "/", label: "ホーム", icon: Home },
    { href: "/notifications", label: "おしらせ", icon: Bell, badge: unreadNotificationCount },
    { href: "/listing", label: "出品", icon: Camera, special: true },
    { href: "/profile", label: "マイページ", icon: User },
    { href: "/transactions", label: "予定", icon: ClipboardList, badge: unreadCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 safe-area-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.03)] [.hide-bottom-nav_&]:hidden">
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
                <div className="relative">
                  <Icon 
                    className={cn("w-6 h-6 transition-all", isActive ? "scale-110" : "")} 
                    strokeWidth={isActive ? 2.5 : 2} 
                  />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm px-1 animate-in zoom-in duration-300">
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
