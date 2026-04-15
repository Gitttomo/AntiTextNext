"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import {
    ArrowLeft,
    Bell,
    Plus,
    X,
    Loader2,
    Search,
    Inbox,
} from "lucide-react";

type WatchKeyword = {
    id: string;
    keyword: string;
    created_at: string;
};

export default function WatchKeywordsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [keywords, setKeywords] = useState<WatchKeyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyword, setNewKeyword] = useState("");
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth/login");
            return;
        }
        if (user) {
            fetchKeywords();
        }
    }, [user, authLoading, router]);

    const fetchKeywords = async () => {
        try {
            const res = await fetch("/api/watch-keywords");
            const data = await res.json();
            if (data.keywords) {
                setKeywords(data.keywords);
            }
        } catch {
            console.error("Failed to fetch keywords");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        const trimmed = newKeyword.trim();
        if (!trimmed || adding) return;

        setAdding(true);
        try {
            const res = await fetch("/api/watch-keywords", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword: trimmed }),
            });
            const data = await res.json();
            if (res.ok && data.keyword) {
                setKeywords(prev => [data.keyword, ...prev]);
                setNewKeyword("");
            } else {
                alert(data.error || "登録に失敗しました");
            }
        } catch {
            alert("通信エラーが発生しました");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/watch-keywords?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setKeywords(prev => prev.filter(k => k.id !== id));
            } else {
                alert("削除に失敗しました");
            }
        } catch {
            alert("通信エラーが発生しました");
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-32">
            <header className="bg-white px-6 pt-8 pb-6 border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/settings">
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <Bell className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl font-bold text-gray-900">
                            探している教科書
                        </h1>
                    </div>
                </div>
            </header>

            <div className="px-6 py-6">
                <div className="max-w-md mx-auto">
                    {/* 説明 */}
                    <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-100">
                        <p className="text-sm text-blue-700">
                            <span className="font-bold">キーワードを登録</span>すると、
                            そのキーワードを含む教科書が出品された時に
                            <span className="font-bold">通知</span>が届きます。
                        </p>
                        <p className="text-xs text-blue-500 mt-2">
                            最大10件まで登録できます（残り{10 - keywords.length}件）
                        </p>
                    </div>

                    {/* 追加フォーム */}
                    <div className="flex gap-2 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                }}
                                placeholder="例: 線形代数、物理学"
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                disabled={keywords.length >= 10}
                            />
                        </div>
                        <button
                            onClick={handleAdd}
                            disabled={!newKeyword.trim() || adding || keywords.length >= 10}
                            className="px-4 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 active:scale-95"
                        >
                            {adding ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    {/* キーワード一覧 */}
                    {keywords.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <Inbox className="w-8 h-8 text-gray-400" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-700 mb-2">
                                登録済みキーワードなし
                            </h2>
                            <p className="text-gray-500 text-sm text-center max-w-xs">
                                探している教科書のキーワードを登録すると、出品された時に通知が届きます
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
                                登録中のキーワード（{keywords.length}/10）
                            </h2>
                            {keywords.map((kw) => (
                                <div
                                    key={kw.id}
                                    className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Search className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 truncate">
                                                {kw.keyword}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {formatDate(kw.created_at)} 登録
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(kw.id)}
                                        disabled={deletingId === kw.id}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90 disabled:opacity-50 flex-shrink-0"
                                        aria-label={`${kw.keyword}を削除`}
                                    >
                                        {deletingId === kw.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <X className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
