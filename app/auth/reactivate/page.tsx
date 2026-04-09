"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import {
    RefreshCw,
    Loader2,
    CheckCircle,
    XCircle,
    UserCheck,
    ArrowLeft,
    LogOut,
} from "lucide-react";

export default function ReactivatePage() {
    const router = useRouter();
    const { user, loading: authLoading, signOut } = useAuth();
    const [reactivating, setReactivating] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth/login");
        }
    }, [user, authLoading, router]);

    const handleReactivate = async () => {
        if (!user) return;
        setReactivating(true);
        setError("");

        try {
            const res = await fetch("/api/reactivate-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
            });

            const data = await res.json();

            if (data.success) {
                setDone(true);
                setTimeout(() => {
                    router.push("/");
                    router.refresh();
                }, 2000);
            } else {
                setError(data.error || "復旧に失敗しました");
            }
        } catch {
            setError("通信エラーが発生しました");
        } finally {
            setReactivating(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/auth/login");
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (done) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-6">
                <div className="max-w-sm mx-auto text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-in">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3 animate-slide-in-left">
                        アカウントを復旧しました！
                    </h1>
                    <p className="text-gray-600 mb-2 animate-slide-in-left" style={{ animationDelay: '100ms' }}>
                        出品中だった商品も再公開されました。
                    </p>
                    <p className="text-gray-400 text-sm animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                        ホームに移動します...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="max-w-sm mx-auto">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce-in">
                        <UserCheck className="w-10 h-10 text-yellow-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-3 animate-slide-in-left">
                        アカウントが停止されています
                    </h1>
                    <p className="text-gray-600 animate-slide-in-left" style={{ animationDelay: '100ms' }}>
                        このアカウントは現在停止中です。<br />
                        復旧するとすべての機能が再び利用可能になります。
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                        <XCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 animate-slide-in-left" style={{ animationDelay: '150ms' }}>
                    <h3 className="font-semibold text-blue-900 mb-2">復旧すると...</h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                        <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>プロフィールが再び表示されます</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>停止中の出品商品が再公開されます</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>すべての機能が利用可能になります</span>
                        </li>
                    </ul>
                </div>

                <div className="space-y-3 animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                    <button
                        onClick={handleReactivate}
                        disabled={reactivating}
                        className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                        {reactivating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                復旧中...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-5 h-5" />
                                アカウントを復旧する
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        ログアウト
                    </button>
                </div>
            </div>
        </div>
    );
}
