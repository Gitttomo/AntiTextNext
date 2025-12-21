"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Inbox, MessageCircle, Star, XCircle, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Notification = {
    id: string;
    type: string;
    title: string;
    message: string;
    link_type: string | null;
    link_id: string | null;
    is_read: boolean;
    created_at: string;
};

export default function NotificationsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            router.push("/auth/login");
            return;
        }

        loadNotifications();

        // Subscribe to new notifications
        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    loadNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, router]);

    const loadNotifications = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (!error && data) {
                setNotifications(data as Notification[]);
            }
        } catch (err) {
            console.error("Error loading notifications:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            await (supabase
                .from("notifications") as any)
                .update({ is_read: true })
                .eq("id", notification.id);
        }

        // Navigate based on link_type
        if (notification.link_type === "chat" && notification.link_id) {
            router.push(`/chat/${notification.link_id}`);
        } else if (notification.link_type === "transaction" && notification.link_id) {
            router.push(`/transactions`);
        } else if (notification.link_type === "profile") {
            router.push(`/profile`);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "purchase_request":
                return <ShoppingBag className="w-5 h-5 text-purple-500" />;
            case "rating_received":
                return <Star className="w-5 h-5 text-yellow-500" />;
            case "transaction_completed":
                return <CheckCircle2 className="w-5 h-5 text-green-500" />;
            case "message":
                return <MessageCircle className="w-5 h-5 text-blue-500" />;
            case "transaction_cancelled":
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "たった今";
        if (diffMins < 60) return `${diffMins}分前`;
        if (diffHours < 24) return `${diffHours}時間前`;
        if (diffDays < 7) return `${diffDays}日前`;

        return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white pb-24 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Header */}
            <header className="bg-white px-6 pt-8 pb-6 border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/">
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Bell className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl font-bold text-gray-900">
                            お知らせ
                        </h1>
                    </div>
                </div>
            </header>

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                        <Inbox className="w-10 h-10 text-gray-400" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">
                        お知らせはありません
                    </h2>
                    <p className="text-gray-500 text-center max-w-xs">
                        新しいお知らせがあるとここに表示されます
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                        <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left ${
                                !notification.is_read ? "bg-blue-50/50" : ""
                            }`}
                        >
                            <div className="flex-shrink-0 mt-1">
                                {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h3 className="font-bold text-gray-900 text-sm">
                                        {notification.title}
                                    </h3>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {formatDate(notification.created_at)}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {notification.message}
                                </p>
                                {!notification.is_read && (
                                    <div className="w-2 h-2 bg-primary rounded-full mt-2" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
