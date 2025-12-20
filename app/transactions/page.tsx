/**
 * 取引一覧ページ
 * 
 * ユーザーの全取引を一覧表示するページです。
 * 
 * 機能:
 * - 取引中タブ: 現在進行中の取引を表示
 * - 履歴タブ: 完了した取引を表示
 * - 購入/出品の区別表示（色分け）
 * - 取引チャットへのリンク
 * 
 * 未ログイン時はログインページにリダイレクトされます。
 */

"use client";

import Link from "next/link";
import { User, GraduationCap, MessageCircle, Package } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type Profile = {
    nickname: string;
    department: string;
};

type TransactionItem = {
    id: string;
    transaction_id: string | null;
    title: string;
    selling_price: number;
    status: string;
    isBuyer: boolean;
    hasTransaction: boolean;
};

export default function TransactionsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [activeTab, setActiveTab] = useState<"active" | "history">("active");
    const [activeItems, setActiveItems] = useState<TransactionItem[]>([]);
    const [historyItems, setHistoryItems] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            router.push("/auth/login");
            return;
        }

        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;

        try {
            // 全てのクエリを並列実行して高速化
            const [
                { data: profileData },
                { data: buyerTransactions },
                { data: sellerItems },
                { data: sellerTransactions }
            ] = await Promise.all([
                // Load user profile
                supabase
                    .from("profiles")
                    .select("nickname, department")
                    .eq("user_id", user.id)
                    .single(),
                // Load items where user is buyer (has transaction)
                supabase
                    .from("transactions")
                    .select(`
                        id,
                        status,
                        items(id, title, selling_price, status)
                    `)
                    .eq("buyer_id", user.id),
                // Load items where user is seller
                supabase
                    .from("items")
                    .select("id, title, selling_price, status, seller_id")
                    .eq("seller_id", user.id),
                // Load transactions where user is seller
                supabase
                    .from("transactions")
                    .select("id, item_id, status")
                    .eq("seller_id", user.id)
            ]);

            if (profileData) {
                setProfile(profileData as Profile);
            }

            // Process active items
            const active: TransactionItem[] = [];
            const history: TransactionItem[] = [];

            // Buyer items (transactions)
            for (const tx of (buyerTransactions || []) as any[]) {
                const item = tx.items;
                if (!item) continue;

                const txItem: TransactionItem = {
                    id: item.id,
                    transaction_id: tx.id,
                    title: item.title,
                    selling_price: item.selling_price,
                    status: tx.status,
                    isBuyer: true,
                    hasTransaction: true,
                };

                if (tx.status === "completed") {
                    history.push(txItem);
                } else {
                    active.push(txItem);
                }
            }

            // Seller items
            const sellerTxMap = new Map<string, any>();
            for (const tx of (sellerTransactions || []) as any[]) {
                sellerTxMap.set(tx.item_id, tx);
            }

            for (const item of (sellerItems || []) as any[]) {
                const tx = sellerTxMap.get(item.id);

                const txItem: TransactionItem = {
                    id: item.id,
                    transaction_id: tx?.id || null,
                    title: item.title,
                    selling_price: item.selling_price,
                    status: tx?.status || item.status,
                    isBuyer: false,
                    hasTransaction: !!tx,
                };

                if (item.status === "sold" || tx?.status === "completed") {
                    history.push(txItem);
                } else {
                    active.push(txItem);
                }
            }

            // Sort active items: items with transactions first (for sellers)
            active.sort((a, b) => {
                // Buyers first
                if (a.isBuyer && !b.isBuyer) return -1;
                if (!a.isBuyer && b.isBuyer) return 1;
                // Then sellers with transactions
                if (!a.isBuyer && !b.isBuyer) {
                    if (a.hasTransaction && !b.hasTransaction) return -1;
                    if (!a.hasTransaction && b.hasTransaction) return 1;
                }
                return 0;
            });

            setActiveItems(active);
            setHistoryItems(history);
        } catch (err) {
            console.error("Error loading data:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-gray-600">読み込み中...</p>
            </div>
        );
    }

    const displayItems = activeTab === "active" ? activeItems : historyItems;

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* Header */}
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <h1 className="text-3xl font-bold text-primary mb-4">取引一覧</h1>

                {/* User Profile Info */}
                {profile && (
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">{profile.nickname}</p>
                            <div className="flex items-center gap-1 text-gray-600">
                                <GraduationCap className="w-4 h-4" />
                                <span className="text-sm">{profile.department}</span>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === "active"
                        ? "text-primary border-b-2 border-primary"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    取引中
                </button>
                <button
                    onClick={() => setActiveTab("history")}
                    className={`flex-1 py-4 text-center font-semibold transition-colors ${activeTab === "history"
                        ? "text-primary border-b-2 border-primary"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    履歴
                </button>
            </div>

            {/* Items List */}
            <div className="px-6 py-6">
                {displayItems.length === 0 ? (
                    <div className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                            {activeTab === "active" ? "取引中の商品はありません" : "取引履歴はありません"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayItems.map((item) => (
                            <div
                                key={`${item.id}-${item.isBuyer ? "buyer" : "seller"}`}
                                className={`bg-white rounded-2xl p-5 shadow-md transition-all duration-300 border-2 ${item.isBuyer
                                    ? "border-blue-400 hover:border-blue-500"
                                    : "border-red-400 hover:border-red-500"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
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
                                                <span className="text-xs text-gray-500">
                                                    {item.isBuyer
                                                        ? "購入中"
                                                        : item.hasTransaction
                                                            ? "取引中"
                                                            : "出品中"}
                                                </span>
                                            )}
                                            {activeTab === "history" && (
                                                <span className="text-xs text-gray-500">
                                                    {item.isBuyer ? "購入済" : "出品済"}
                                                </span>
                                            )}
                                        </div>

                                        <Link href={`/product/${item.id}`}>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2 hover:text-primary transition-colors">
                                                {item.title}
                                            </h3>
                                        </Link>
                                        <p className="text-xl font-bold text-primary">
                                            ¥{item.selling_price.toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Chat Button - only for active items with transaction */}
                                    {activeTab === "active" && item.hasTransaction && item.transaction_id && (
                                        <Link
                                            href={`/chat/${item.transaction_id}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all text-sm"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            チャット
                                        </Link>
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
