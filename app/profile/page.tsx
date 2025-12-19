"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { ArrowLeft, User, GraduationCap, LogOut } from "lucide-react";

export default function ProfilePage() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [nickname, setNickname] = useState("");
    const [department, setDepartment] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const loadedUserRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user) {
            router.push("/auth/login");
            return;
        }

        // 同じユーザーで既に読み込み済みなら再取得しない
        if (loadedUserRef.current === user.id) return;
        loadedUserRef.current = user.id;
        loadProfile();
    }, [user]);

    const loadProfile = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (error) throw error;

            if (data) {
                setNickname((data as any).nickname);
                setDepartment((data as any).department);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setError("");
        setSuccess(false);

        try {
            const { error } = await (supabase
                .from("profiles") as any)
                .update({
                    nickname,
                    department,
                })
                .eq("user_id", user.id);

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/auth/login");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <p className="text-gray-600">読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <header className="bg-white px-6 pt-8 pb-6 border-b">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/">
                        <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                    </Link>
                    <h1 className="text-3xl font-bold text-primary">
                        プロフィール
                    </h1>
                </div>
            </header>

            <div className="px-6 py-8">
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg border p-8">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                アカウント情報
                            </h2>
                            <p className="text-sm text-gray-600">{user?.email}</p>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">
                                プロフィールを更新しました
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <User className="w-4 h-4 inline mr-1" />
                                    ニックネーム
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GraduationCap className="w-4 h-4 inline mr-1" />
                                    学部
                                </label>
                                <select
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                >
                                    <option value="">選択してください</option>
                                    <option value="工学部">工学部</option>
                                    <option value="理学部">理学部</option>
                                    <option value="情報学部">情報学部</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                            >
                                {saving ? "保存中..." : "保存"}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t">
                            <button
                                onClick={handleSignOut}
                                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-5 h-5" />
                                ログアウト
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
