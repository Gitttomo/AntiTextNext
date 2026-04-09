"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Mail, Lock, CheckCircle } from "lucide-react";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal";
import { isAllowedAdminEmail } from "@/lib/admin";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [agreedToLegal, setAgreedToLegal] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // Prefetch login page for instant transition
    useEffect(() => {
        router.prefetch("/auth/login");
    }, [router]);

    const normalizedEmail = email.trim().toLowerCase();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate email domain
        const isCampusEmail = normalizedEmail.endsWith("@m.isct.ac.jp");
        const isRegisteredAdminEmail = isCampusEmail
            ? false
            : await isAllowedAdminEmail(supabase as any, normalizedEmail);

        if (!isCampusEmail && !isRegisteredAdminEmail) {
            setError("学内メールアドレス（@m.isct.ac.jp）または登録済みの管理者メールアドレスを使用してください");
            return;
        }

        // Validate password match
        if (password !== confirmPassword) {
            setError("パスワードが一致しません");
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError("パスワードは6文字以上で入力してください");
            return;
        }

        if (!agreedToLegal) {
            setError("利用規約・プライバシーポリシーへの同意が必要です");
            return;
        }

        setLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                    data: {
                        accepted_terms_version: CURRENT_TERMS_VERSION,
                        accepted_privacy_version: CURRENT_PRIVACY_VERSION,
                        accepted_legal_at: new Date().toISOString(),
                    },
                },
            });

            if (authError) throw authError;

            // メール送信成功画面へ切り替え
            setEmailSent(true);
        } catch (err: any) {
            setError(err.message || "登録に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    // メール送信完了画面
    if (emailSent) {
        return (
            <div className="min-h-screen bg-white">
                <header className="bg-white px-6 pt-8 pb-6 border-b">
                    <div className="flex items-center gap-4 mb-6">
                        <Link href="/">
                            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
                        </Link>
                        <h1 className="text-3xl font-bold text-primary animate-slide-in-left">
                            メール確認
                        </h1>
                    </div>
                </header>

                <div className="px-6 py-8">
                    <div className="max-w-md mx-auto">
                        <div className="bg-white rounded-2xl shadow-lg border p-8 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-slide-in-left">
                                <Mail className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 animate-slide-in-left" style={{ animationDelay: '100ms' }}>
                                確認メールを送信しました
                            </h2>
                            <p className="text-gray-600 mb-2 animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                                <span className="font-semibold text-primary">{email}</span>
                            </p>
                            <p className="text-gray-600 mb-6 animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                                上記のメールアドレスに確認メールを送信しました。
                                メール内のリンクをクリックして、登録を完了してください。
                            </p>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left mb-6 animate-slide-in-left" style={{ animationDelay: '300ms' }}>
                                <p className="text-sm text-yellow-800 font-medium mb-2">📌 メールが届かない場合</p>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                    <li>• 迷惑メールフォルダを確認してください</li>
                                    <li>• メールアドレスが正しいか確認してください</li>
                                    <li>• 数分待ってから再度お試しください</li>
                                </ul>
                            </div>

                            <div className="space-y-3 animate-slide-in-left" style={{ animationDelay: '400ms' }}>
                                <button
                                    onClick={() => {
                                        setEmailSent(false);
                                        setEmail("");
                                        setPassword("");
                                        setConfirmPassword("");
                                    }}
                                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                                >
                                    別のメールアドレスで登録
                                </button>
                                <Link
                                    href="/auth/login"
                                    className="block w-full py-3 text-primary font-semibold hover:underline"
                                >
                                    ログインページに戻る
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
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
                    <h1 className="text-3xl font-bold text-primary animate-slide-in-left">
                        新規登録
                    </h1>
                </div>
            </header>

            <div className="px-6 py-8">
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg border p-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center animate-slide-in-left">
                            アカウント作成
                        </h2>

                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="animate-slide-in-left">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Mail className="w-4 h-4 inline mr-1" />
                                    学内メールアドレス
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="example@m.isct.ac.jp"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    ※ 通常は @m.isct.ac.jp のメールのみ登録可能です。管理者として事前登録されたメールアドレスは例外的に利用できます。
                                </p>
                            </div>

                            <div className="animate-slide-in-left" style={{ animationDelay: '100ms' }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Lock className="w-4 h-4 inline mr-1" />
                                    パスワード
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="6文字以上"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div className="animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <Lock className="w-4 h-4 inline mr-1" />
                                    パスワード（確認）
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="もう一度入力"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-slide-in-left" style={{ animationDelay: '250ms' }}>
                                <p className="text-sm text-blue-800">
                                    📧 登録後、メールアドレスに確認メールが送信されます。メール内のリンクをクリックして登録を完了してください。
                                </p>
                            </div>

                            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 animate-slide-in-left" style={{ animationDelay: '280ms' }}>
                                <input
                                    type="checkbox"
                                    checked={agreedToLegal}
                                    onChange={(e) => setAgreedToLegal(e.target.checked)}
                                    className="mt-1 h-5 w-5 accent-primary"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    利用規約・プライバシーポリシーに同意して登録する
                                </span>
                            </label>

                             <button
                                type="submit"
                                disabled={loading || !agreedToLegal}
                                className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg mt-6 animate-slide-in-left"
                                style={{ animationDelay: '300ms' }}
                            >
                                {loading ? "送信中..." : "確認メールを送信"}
                            </button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-gray-600">
                                すでにアカウントをお持ちの方は
                            </p>
                            <Link
                                href="/auth/login"
                                className="text-primary font-semibold hover:underline"
                            >
                                ログインはこちら
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
