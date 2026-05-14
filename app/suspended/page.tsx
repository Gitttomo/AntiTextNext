"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";

export default function SuspendedPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [restriction, setRestriction] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRestriction = async () => {
            if (!user) {
                router.replace("/auth/login");
                return;
            }

            const { data } = await supabase
                .from("user_restrictions")
                .select("*")
                .eq("user_id", user.id)
                .in("restriction_type", ["temporary_suspend", "permanent_ban"])
                .is("lifted_at", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (data) {
                const res = data as any;
                // 一時停止の場合、期限が過ぎていればホームへ
                if (res.restriction_type === "temporary_suspend" && res.ends_at) {
                    if (new Date(res.ends_at) <= new Date()) {
                        router.replace("/");
                        return;
                    }
                }
                setRestriction(res);
            } else {
                router.replace("/");
            }
            setLoading(false);
        };

        fetchRestriction();
    }, [user, router]);

    const handleSignOut = async () => {
        await signOut();
        router.push("/auth/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    if (!restriction) return null;

    const isBan = restriction.restriction_type === "permanent_ban";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center animate-slide-in-bottom">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {isBan ? "アカウントが永久停止されています" : "アカウントが一時停止されています"}
                </h1>
                
                <p className="text-sm text-gray-600 mb-6">
                    利用規約への違反が確認されたため、現在このアカウントでの機能の利用を制限しています。
                </p>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-8 text-left">
                    <div className="mb-4">
                        <span className="block text-xs font-bold text-gray-500 mb-1">制限の理由</span>
                        <p className="text-sm font-bold text-gray-900 whitespace-pre-wrap">{restriction.reason || "運営の判断による"}</p>
                    </div>
                    
                    {!isBan && restriction.ends_at && (
                        <div>
                            <span className="block text-xs font-bold text-gray-500 mb-1">制限解除予定</span>
                            <p className="text-sm font-bold text-gray-900">
                                {new Date(restriction.ends_at).toLocaleString("ja-JP")}
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleSignOut}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    ログアウト
                </button>
                
                <p className="text-xs text-gray-500 mt-6">
                    ご不明な点がございましたら、textnextbbs@gmail.com までお問い合わせください。
                </p>
            </div>
        </div>
    );
}
