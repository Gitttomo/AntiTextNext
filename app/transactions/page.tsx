"use client";

import Link from "next/link";
import Image from "next/image";
import { User, GraduationCap, MessageCircle, Package, BookOpen } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Profile = {
    nickname: string;
    department: string;
};

type TransactionItem = {
    id: string;
    title: string;
    selling_price: number;
    status: string;
    front_image_url: string | null;
    isBuyer: boolean;
    hasTransaction: boolean;
    unreadCount: number;
};

export default function TransactionsPage() {
    const router = useRouter();
    const { user, avatarUrl } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [activeItems, setActiveItems] = useState<TransactionItem[]>([]);
    const [historyItems, setHistoryItems] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const loadedUserRef = useRef<string | null>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        if (!user) return;

        try {
            const [
                { data: profileData },
                { data: buyerTransactions },
                { data: sellerItems },
                { data: sellerTransactions },
                { data: unreadMessages }
            ] = await Promise.all([
                supabase
                    .from("profiles")
                    .select("nickname, department")
                    .eq("user_id", user.id)
                    .single(),
                supabase
                    .from("transactions")
                    .select(`
                        id,
                        status,
                        item_id,
                        items(id, title, selling_price, status, front_image_url)
                    `)
                    .eq("buyer_id", user.id),
                supabase
                    .from("items")
                    .select("id, title, selling_price, status, seller_id, front_image_url")
                    .eq("seller_id", user.id),
                supabase
                    .from("transactions")
                    .select("id, item_id, status")
                    .eq("seller_id", user.id),
                // 未読メッセージ数を取得（自分宛ての未読メッセージ）
                supabase
                    .from("messages")
                    .select("item_id")
                    .eq("receiver_id", user.id)
                    .eq("is_read", false)
            ]);

            if (profileData) {
                setProfile(profileData as Profile);
            }

            // 未読メッセージをitem_idごとにカウント
            const unreadCountMap = new Map<string, number>();
            if (unreadMessages) {
                for (const msg of unreadMessages as any[]) {
                    const count = unreadCountMap.get(msg.item_id) || 0;
                    unreadCountMap.set(msg.item_id, count + 1);
                }
            }

            const active: TransactionItem[] = [];
            const history: TransactionItem[] = [];

            for (const tx of (buyerTransactions || []) as any[]) {
                const item = tx.items;
                if (!item) continue;

                const txItem: TransactionItem = {
                    id: item.id,
                    title: item.title,
                    selling_price: item.selling_price,
                    status: item.status,
                    front_image_url: item.front_image_url || null,
                    isBuyer: true,
                    hasTransaction: true,
                    unreadCount: unreadCountMap.get(item.id) || 0,
                };

                if (tx.status === "completed" || item.status === "sold") {
                    history.push(txItem);
                } else {
                    active.push(txItem);
                }
            }

            const sellerTxMap = new Map<string, { txId: string; txStatus: string }>();
            for (const tx of (sellerTransactions || []) as any[]) {
                sellerTxMap.set(tx.item_id, { txId: tx.id, txStatus: tx.status });
            }

            for (const item of (sellerItems || []) as any[]) {
                const txInfo = sellerTxMap.get(item.id);

                const txItem: TransactionItem = {
                    id: item.id,
                    title: item.title,
                    selling_price: item.selling_price,
                    status: item.status,
                    front_image_url: item.front_image_url || null,
                    isBuyer: false,
                    hasTransaction: !!txInfo,
                    unreadCount: unreadCountMap.get(item.id) || 0,
                };

                if (item.status === "sold" || txInfo?.txStatus === "completed") {
                    history.push(txItem);
                } else if (item.status === "transaction_pending" || txInfo) {
                    active.push(txItem);
                }
            }

            setActiveItems(active);
            setHistoryItems(history);
        } catch (err) {
            console.error("Error loading transactions:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            router.push("/auth/login");
            return;
        }

        if (loadedUserRef.current === user.id) return;
        loadedUserRef.current = user.id;
        loadData();

        // 5秒ごとにポーリングして未読を更新
        pollingRef.current = setInterval(() => {
            loadData();
        }, 5000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [user, router, loadData]);

    // 合計未読数
    const totalUnreadCount = activeItems.reduce((sum, item) => sum + item.unreadCount, 0) +
        historyItems.reduce((sum, item) => sum + item.unreadCount, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-gray-600">読み込み中...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const displayItems = activeTab === "active" ? activeItems : historyItems;
    const activeUnreadCount = activeItems.reduce((sum, item) => sum + item.unreadCount, 0);
    const historyUnreadCount = historyItems.reduce((sum, item) => sum + item.unreadCount, 0);

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Header */}
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-primary">取引一覧</h1>
                    {totalUnreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
                            {totalUnreadCount}
                        </span>
                    )}
                </div>

                {/* User Profile Info */}
                {profile && (
                    <Link href="/profile" className="mt-4 block">
                        <div className="flex items-center gap-3 hover:bg-gray-50 rounded-xl p-2 -m-2 transition-colors cursor-pointer">
                            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20">
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt="プロフィール"
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">{profile.nickname}</p>
                                <div className="flex items-center gap-1 text-gray-600">
                                    <GraduationCap className="w-4 h-4" />
                                    <span className="text-sm">{profile.department}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}
            </header>

            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`flex-1 py-4 text-center font-semibold transition-colors relative ${activeTab === "active"
                        ? "text-primary border-b-2 border-primary"
                        : "text-gray-500"
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        取引中 ({activeItems.length})
                        {activeUnreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                {activeUnreadCount}
                            </span>
                        )}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === "history"
                        ? "text-primary border-b-2 border-primary"
                        : "text-gray-500"
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        履歴 ({historyItems.length})
                        {historyUnreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                {historyUnreadCount}
                            </span>
                        )}
                    </span>
                </button>
            </div>

            {/* Transaction List */}
            <div className="px-6 py-6">
                {displayItems.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {activeTab === "active"
                                ? "取引中の商品はありません"
                                : "取引履歴はありません"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayItems.map((item, index) => (
                            <div
                                key={`${item.id}-${item.isBuyer ? "buyer" : "seller"}`}
                                onClick={() => router.push(`/product/${item.id}`)}
                                className={`bg-white rounded-2xl p-5 shadow-md transition-all duration-300 border-2 cursor-pointer group active:scale-[0.98] animate-slide-in-top ${item.isBuyer
                                    ? "border-blue-400 hover:border-blue-500 hover:shadow-lg"
                                    : "border-red-400 hover:border-red-500 hover:shadow-lg"
                                    }`}
                                style={{ animationDelay: `${index * 80}ms` }}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Product Image */}
                                    <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden group-hover:scale-105 transition-transform">
                                        {item.front_image_url ? (
                                            <Image
                                                src={item.front_image_url}
                                                alt={item.title}
                                                width={64}
                                                height={64}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <BookOpen className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        {/* Role Badge */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span
                                                className={`text-xs font-medium px-2 py-1 rounded-full ${item.isBuyer
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {item.isBuyer ? "購入" : "出品"}
                                            </span>
                                            {activeTab === "active" && (
                                                <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                                                    取引中
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <h3 className="font-bold text-gray-900 truncate group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h3>

                                        {/* Price */}
                                        <p className="text-lg font-bold text-primary">
                                            ¥{item.selling_price.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Action Button with Unread Badge */}
                                    {item.hasTransaction && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/chat/${item.id}`);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm z-10"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                                チャット
                                            </button>
                                            {/* 未読バッジ */}
                                            {item.unreadCount > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-pulse">
                                                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
