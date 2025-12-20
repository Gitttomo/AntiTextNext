"use client";

import Link from "next/link";
import Image from "next/image";
import { User, GraduationCap, MessageCircle, Package, BookOpen, Calendar, MapPin, Clock, RotateCcw, ChevronDown, ChevronUp, CheckCircle, Star } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { TransactionsSkeleton } from "./skeleton";

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
    final_meetup_time?: string | null;
    final_meetup_location?: string | null;
    transactionStatus?: string;
};

type TransactionsClientProps = {
    initialActiveItems: TransactionItem[];
    initialHistoryItems: TransactionItem[];
    initialProfile: Profile | null;
    serverSession?: boolean;
};

export default function TransactionsClient({
    initialActiveItems,
    initialHistoryItems,
    initialProfile,
    serverSession = true
}: TransactionsClientProps) {
    const router = useRouter();
    const { user, avatarUrl, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(initialProfile);
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [activeItems, setActiveItems] = useState<TransactionItem[]>(initialActiveItems);
    const [historyItems, setHistoryItems] = useState<TransactionItem[]>(initialHistoryItems);
    const [initialCheckDone, setInitialCheckDone] = useState(serverSession);
    const [isPendingCollapsed, setIsPendingCollapsed] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // If server didn't find a session, check client-side on mount
    useEffect(() => {
        if (!serverSession && !authLoading) {
            if (!user) {
                router.push("/auth/login");
            } else {
                loadData();
                setInitialCheckDone(true);
            }
        }
    }, [user, authLoading, serverSession, router]);

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
                        final_meetup_time,
                        final_meetup_location,
                        items(id, title, selling_price, status, front_image_url)
                    `)
                    .eq("buyer_id", user.id),
                supabase
                    .from("items")
                    .select("id, title, selling_price, status, seller_id, front_image_url")
                    .eq("seller_id", user.id),
                supabase
                    .from("transactions")
                    .select("id, item_id, status, final_meetup_time, final_meetup_location")
                    .eq("seller_id", user.id),
                supabase
                    .from("messages")
                    .select("item_id")
                    .eq("receiver_id", user.id)
                    .eq("is_read", false)
            ]);

            if (profileData) {
                setProfile(profileData as Profile);
            }

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
                    final_meetup_time: tx.final_meetup_time,
                    final_meetup_location: tx.final_meetup_location,
                    transactionStatus: tx.status,
                };

                if (tx.status === "completed" || item.status === "sold") {
                    history.push(txItem);
                } else {
                    // Include pending, confirmed, and awaiting_rating in active
                    active.push(txItem);
                }
            }

            const sellerTxMap = new Map<string, { txId: string; txStatus: string; final_meetup_time: string | null; final_meetup_location: string | null }>();
            for (const tx of (sellerTransactions || []) as any[]) {
                sellerTxMap.set(tx.item_id, { 
                    txId: tx.id, 
                    txStatus: tx.status,
                    final_meetup_time: tx.final_meetup_time,
                    final_meetup_location: tx.final_meetup_location
                });
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
                    final_meetup_time: txInfo?.final_meetup_time,
                    final_meetup_location: txInfo?.final_meetup_location,
                    transactionStatus: txInfo?.txStatus,
                };

                if (item.status === "sold" || txInfo?.txStatus === "completed") {
                    history.push(txItem);
                } else if (item.status === "transaction_pending" || txInfo) {
                    // Include pending, confirmed, and awaiting_rating in active
                    active.push(txItem);
                }
            }

            setActiveItems(active);
            setHistoryItems(history);
        } catch (err) {
            console.error("Error loading transactions:", err);
        }
    }, [user]);

    useEffect(() => {
        if (!user || !initialCheckDone) return;

        pollingRef.current = setInterval(() => {
            loadData();
        }, 5000);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [user, loadData, initialCheckDone]);

    const totalUnreadCount = activeItems.reduce((sum, item) => sum + item.unreadCount, 0) +
        historyItems.reduce((sum, item) => sum + item.unreadCount, 0);

    const activeUnreadCount = activeItems.reduce((sum, item) => sum + item.unreadCount, 0);
    const historyUnreadCount = historyItems.reduce((sum, item) => sum + item.unreadCount, 0);

    // Grouping logic for "Active" tab
    const groupedItemsByDate = activeItems.reduce((groups, item) => {
        const date = item.final_meetup_time || "未定";
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(item);
        return groups;
    }, {} as Record<string, TransactionItem[]>);

    // Sort dates: "未定" first, then others sorted by date string
    const sortedDates = Object.keys(groupedItemsByDate).sort((a, b) => {
        if (a === "未定") return -1;
        if (b === "未定") return 1;
        return a.localeCompare(b);
    });

    if (!initialCheckDone || authLoading) {
        return <TransactionsSkeleton />;
    }

    const renderItem = (item: TransactionItem, index: number) => (
        <div
            key={`${item.id}-${item.isBuyer ? "buyer" : "seller"}`}
            onClick={() => router.push(`/product/${item.id}`)}
            className={`bg-white rounded-3xl p-5 shadow-sm transition-all duration-300 border-2 cursor-pointer group active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 ${item.isBuyer
                ? "border-blue-100 hover:border-blue-400 hover:shadow-xl"
                : "border-red-100 hover:border-red-400 hover:shadow-xl"
                }`}
            style={{ animationDelay: `${index * 50}ms` }}
        >
            <div className="flex items-start gap-4">
                <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-2xl overflow-hidden group-hover:scale-105 transition-transform">
                    {item.front_image_url ? (
                        <Image
                            src={item.front_image_url}
                            alt={item.title}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <BookOpen className="w-8 h-8" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                            className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${item.isBuyer
                                ? "bg-blue-50 text-blue-600 border border-blue-100"
                                : "bg-red-50 text-red-600 border border-red-100"
                                }`}
                        >
                            {item.isBuyer ? "購入" : "出品"}
                        </span>
                        {item.transactionStatus === "awaiting_rating" ? (
                             <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-full flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                評価待ち
                             </span>
                        ) : item.final_meetup_time ? (
                             <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-green-50 text-green-600 border border-green-100 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                確定
                             </span>
                        ) : activeTab === "active" ? (
                            <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-full">
                                調整中
                            </span>
                        ) : null}
                    </div>

                    <h3 className="font-black text-gray-900 truncate text-lg group-hover:text-primary transition-colors">
                        {item.title}
                    </h3>

                    <div className="flex items-center justify-between mt-1">
                        <p className="text-xl font-black text-primary">
                            ¥{item.selling_price.toLocaleString()}
                        </p>
                        
                        {item.hasTransaction && (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/chat/${item.id}`);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-2xl font-black hover:bg-primary/90 transition-all text-xs shadow-lg shadow-primary/20"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    チャット
                                </button>
                                {item.unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-pulse">
                                        {item.unreadCount > 99 ? "99+" : item.unreadCount}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {item.final_meetup_time && (
                        <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1">
                             <div className="flex items-center gap-2 text-gray-500 font-bold text-[11px]">
                                <Clock className="w-3 h-3 text-primary/40" />
                                <span>{item.final_meetup_time}</span>
                             </div>
                             {item.final_meetup_location && (
                                <div className="flex items-center gap-2 text-gray-400 font-medium text-[11px]">
                                    <MapPin className="w-3 h-3 text-primary/40" />
                                    <span>{item.final_meetup_location}</span>
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <header className="bg-white px-6 pt-10 pb-8 rounded-b-[40px] shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">予定管理</h1>
                        {totalUnreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg shadow-red-500/20">
                                {totalUnreadCount}
                            </span>
                        )}
                    </div>
                </div>

                {profile && (
                    <Link href="/profile" className="mt-6 block group">
                        <div className="flex items-center gap-4 bg-gray-50 rounded-[28px] p-4 transition-all hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98]">
                            <div className="w-14 h-14 rounded-full overflow-hidden border-4 border-white shadow-md">
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt="プロフィール"
                                        width={56}
                                        height={56}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                                        <User className="w-7 h-7 text-primary" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-gray-900 text-lg">{profile.nickname}</p>
                                <div className="flex items-center gap-1.5 text-gray-500">
                                    <GraduationCap className="w-4 h-4 text-primary/40" />
                                    <span className="text-xs font-bold uppercase tracking-wider">{profile.department}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                )}
            </header>

            <div className="px-6 -mt-6">
                <div className="bg-white/80 backdrop-blur-md rounded-[32px] p-1.5 flex shadow-xl border border-white/50">
                    <button
                        onClick={() => setActiveTab("active")}
                        className={`flex-1 py-4 text-sm font-black transition-all rounded-[24px] relative ${activeTab === "active"
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        取引中 ({activeItems.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-4 text-sm font-black transition-all rounded-[24px] ${activeTab === "history"
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        履歴 ({historyItems.length})
                    </button>
                </div>
            </div>

            <div className="px-6 py-8">
                {activeTab === "active" ? (
                    sortedDates.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[40px] shadow-sm border border-gray-100">
                            <Package className="w-20 h-20 text-gray-100 mx-auto mb-4" />
                            <p className="text-gray-400 font-black">取引中の商品はありません</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {sortedDates.map((date) => {
                                const isPending = date === "未定";
                                const itemsCount = groupedItemsByDate[date].length;

                                if (isPending) {
                                    return (
                                        <section key={date} className="space-y-4">
                                            <button
                                                onClick={() => setIsPendingCollapsed(!isPendingCollapsed)}
                                                className="w-full flex items-center justify-between p-4 bg-gray-100/50 hover:bg-gray-100 rounded-3xl transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100">
                                                        <Calendar className="w-5 h-5 text-gray-300" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h2 className="font-black tracking-tight text-gray-400 text-lg">
                                                            {date}
                                                        </h2>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            日程調整が必要
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-gray-200 text-gray-500 text-[10px] font-black px-2 py-0.5 rounded-full ring-2 ring-white">
                                                        {itemsCount}
                                                    </span>
                                                    {isPendingCollapsed ? (
                                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                                    ) : (
                                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                            </button>
                                            
                                            {!isPendingCollapsed && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    {groupedItemsByDate[date].map((item, idx) => renderItem(item, idx))}
                                                </div>
                                            )}
                                        </section>
                                    );
                                }

                                return (
                                    <section key={date} className="space-y-4">
                                        <div className="flex items-center gap-3 px-2">
                                            <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-gray-100">
                                                <Calendar className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h2 className="font-black tracking-tight text-gray-900 text-xl">
                                                    {date}
                                                </h2>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">確定済み</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {groupedItemsByDate[date].map((item, idx) => renderItem(item, idx))}
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="space-y-4">
                        {historyItems.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-[40px] shadow-sm border border-gray-100">
                                <RotateCcw className="w-20 h-20 text-gray-100 mx-auto mb-4" />
                                <p className="text-gray-400 font-black">取引履歴はありません</p>
                            </div>
                        ) : (
                            historyItems.map((item, idx) => renderItem(item, idx))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

