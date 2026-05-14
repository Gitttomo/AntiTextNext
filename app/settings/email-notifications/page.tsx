"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

export default function EmailNotificationsSettingsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // 通知設定のstate
    const [notifyWatch, setNotifyWatch] = useState(true);
    const [notifyProgress, setNotifyProgress] = useState(true);
    const [notifyReminders, setNotifyReminders] = useState(true);
    const [notifyChat, setNotifyChat] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/auth/login");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchPreferences = async () => {
            if (!user) return;
            try {
                const { data, error } = await (supabase.from("profiles") as any)
                    .select("email_notify_watch_keywords, email_notify_transaction_progress, email_notify_reminders, email_notify_chat_messages")
                    .eq("user_id", user.id)
                    .single();

                if (error) throw error;
                if (data) {
                    // もしDBにまだカラムがない/nullの場合はデフォルトtrueにする
                    setNotifyWatch(data.email_notify_watch_keywords ?? true);
                    setNotifyProgress(data.email_notify_transaction_progress ?? true);
                    setNotifyReminders(data.email_notify_reminders ?? true);
                    setNotifyChat(data.email_notify_chat_messages ?? true);
                }
            } catch (err) {
                console.error("Error fetching preferences:", err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchPreferences();
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setError("");
        setSuccess(false);

        try {
            const { error } = await (supabase.from("profiles") as any)
                .update({
                    email_notify_watch_keywords: notifyWatch,
                    email_notify_transaction_progress: notifyProgress,
                    email_notify_reminders: notifyReminders,
                    email_notify_chat_messages: notifyChat,
                })
                .eq("user_id", user.id);

            if (error) throw error;
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || "設定の保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <header className="bg-white px-6 pt-8 pb-6 border-b sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link href="/settings">
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-primary" />
                        メール通知設定
                    </h1>
                </div>
            </header>

            <main className="px-6 py-8">
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        
                        <p className="text-sm text-gray-600 mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl">
                            <span className="font-bold text-blue-800">重要:</span> 運営からのお知らせや、アカウントに関する重要なお知らせは、以下の設定にかかわらず必ず送信されます。
                        </p>

                        <div className="space-y-6">
                            {/* 探している教科書 */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">探している教科書の新着通知</h3>
                                    <p className="text-xs text-gray-500 mt-1">登録したキーワードに一致する商品が出品された際に通知します。</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                    <input type="checkbox" className="sr-only peer" checked={notifyWatch} onChange={(e) => setNotifyWatch(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <hr className="border-gray-100" />

                            {/* 取引進展 */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">取引進展の通知</h3>
                                    <p className="text-xs text-gray-500 mt-1">購入リクエストの受信、承認、辞退、および相互評価の催促など、取引の進行に関する通知を行います。</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                    <input type="checkbox" className="sr-only peer" checked={notifyProgress} onChange={(e) => setNotifyProgress(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <hr className="border-gray-100" />

                            {/* リマインド */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">取引前日のリマインド通知</h3>
                                    <p className="text-xs text-gray-500 mt-1">商品の受け渡し予定日の前日に、取引の詳細（時間や場所など）をリマインドします。</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                    <input type="checkbox" className="sr-only peer" checked={notifyReminders} onChange={(e) => setNotifyReminders(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <hr className="border-gray-100" />

                            {/* チャット */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">チャットの新規メッセージ</h3>
                                    <p className="text-xs text-gray-500 mt-1">取引相手から新しいメッセージを受信した際に通知します。</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                                    <input type="checkbox" className="sr-only peer" checked={notifyChat} onChange={(e) => setNotifyChat(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold flex items-center gap-2">
                                設定を保存しました。
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full mt-8 py-4 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            {saving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            設定を保存
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
