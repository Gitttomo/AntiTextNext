"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Mail, Lock, User, GraduationCap } from "lucide-react";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [nickname, setNickname] = useState("");
    const [department, setDepartment] = useState("");
    const [degree, setDegree] = useState("学士");
    const [grade, setGrade] = useState("1");
    const [major, setMajor] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Prefetch login page for instant transition
    useEffect(() => {
        router.prefetch("/auth/login");
    }, [router]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate email domain
        if (!email.endsWith("@m.isct.ac.jp")) {
            setError("学内メールアドレス（@m.isct.ac.jp）を使用してください");
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

        setLoading(true);

        try {
            // Sign up user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // Create profile
                const { error: profileError } = await (supabase
                    .from("profiles") as any)
                    .insert({
                        user_id: authData.user.id,
                        nickname,
                        department,
                        degree,
                        grade: parseInt(grade),
                        major: (degree !== "学士" || parseInt(grade) >= 2) ? major : null,
                    });

                if (profileError) throw profileError;

                alert("登録が完了しました！ログインページに移動します。");
                router.push("/auth/login");
            }
        } catch (err: any) {
            setError(err.message || "登録に失敗しました");
        } finally {
            setLoading(false);
        }
    };

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
                                    ※ @m.isct.ac.jp のメールのみ登録可能
                                </p>
                            </div>

                            <div className="animate-slide-in-left" style={{ animationDelay: '100ms' }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <User className="w-4 h-4 inline mr-1" />
                                    ニックネーム
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="山田太郎"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                />
                            </div>

                            <div className="animate-slide-in-left" style={{ animationDelay: '200ms' }}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <GraduationCap className="w-4 h-4 inline mr-1" />
                                    学院
                                </label>
                                <select
                                    value={department}
                                    onChange={(e) => {
                                        setDepartment(e.target.value);
                                        setMajor(""); // 学院が変わったら専攻をリセット
                                    }}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                    required
                                >
                                    <option value="">選択してください</option>
                                    <option value="理学院">理学院</option>
                                    <option value="工学院">工学院</option>
                                    <option value="物質理工学院">物質理工学院</option>
                                    <option value="情報理工学院">情報理工学院</option>
                                    <option value="生命理工学院">生命理工学院</option>
                                    <option value="環境・社会理工学院">環境・社会理工学院</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>

                            <div className="flex gap-4 animate-slide-in-left" style={{ animationDelay: '250ms' }}>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        課程
                                    </label>
                                    <select
                                        value={degree}
                                        onChange={(e) => setDegree(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        required
                                    >
                                        <option value="学士">学士</option>
                                        <option value="修士">修士</option>
                                        <option value="博士">博士</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        学年
                                    </label>
                                    <select
                                        value={grade}
                                        onChange={(e) => setGrade(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        required
                                    >
                                        {degree === "学士" && [1, 2, 3, 4].map(g => (
                                            <option key={g} value={g}>{g}年</option>
                                        ))}
                                        {degree === "修士" && [1, 2].map(g => (
                                            <option key={g} value={g}>{g}年</option>
                                        ))}
                                        {degree === "博士" && [1, 2, 3, 4, 5].map(g => (
                                            <option key={g} value={g}>{g}年</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {(degree !== "学士" || parseInt(grade) >= 2) && department && (
                                <div className="animate-slide-in-left" style={{ animationDelay: '280ms' }}>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        系（専攻）
                                    </label>
                                    <select
                                        value={major}
                                        onChange={(e) => setMajor(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                        required
                                    >
                                        <option value="">選択してください</option>
                                        {department === "理学院" && ["数学系", "物理学系", "化学系", "地球惑星科学系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        {department === "工学院" && ["機械系", "システム制御系", "電気電子系", "情報通信系", "経営工学系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        {department === "物質理工学院" && ["材料系", "応用科学系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        {department === "情報理工学院" && ["数理・計算科学系", "情報工学系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        {department === "生命理工学院" && ["生命理工系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        {department === "環境・社会理工学院" && ["建築学系", "土木・環境工学系", "融合理工学系"].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                        <option value="その他">その他</option>
                                    </select>
                                </div>
                            )}

                            <div className="animate-slide-in-left" style={{ animationDelay: '300ms' }}>
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

                            <div className="animate-slide-in-left" style={{ animationDelay: '400ms' }}>
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

                             <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg mt-6 animate-slide-in-left"
                                style={{ animationDelay: '500ms' }}
                            >
                                {loading ? "登録中..." : "登録"}
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
