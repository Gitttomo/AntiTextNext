"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const RESET_LINK_ERROR_MESSAGE = "再設定リンクの有効期限が切れているか、すでに使用されています。\nお手数ですが、もう一度パスワード再設定メールを送信してください。";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") || hashParams.get("error");

      if (hashError) {
        setError(RESET_LINK_ERROR_MESSAGE);
        setCheckingSession(false);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        window.history.replaceState(null, "", window.location.pathname);

        if (sessionError) {
          setError(RESET_LINK_ERROR_MESSAGE);
          setCheckingSession(false);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(RESET_LINK_ERROR_MESSAGE);
        setCheckingSession(false);
        return;
      }

      setCanUpdate(true);
      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }

    if (password !== confirmPassword) {
      setError("確認用パスワードが一致しません");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/auth/login");
        router.refresh();
      }, 1800);
    } catch (err: any) {
      const message = String(err?.message || "").toLowerCase();
      if (message.includes("weak") || message.includes("password")) {
        setError("パスワード条件を満たしていません。8文字以上で、推測されにくいパスワードを入力してください。");
      } else {
        setError("パスワードの更新に失敗しました。メールのリンクを開き直して再度お試しください。");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/auth/login">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <h1 className="text-3xl font-bold text-primary">新しいパスワード</h1>
        </div>
      </header>

      <div className="px-6 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border p-8">
            {success ? (
              <div className="text-center">
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-900 mb-3">更新しました</h2>
                <p className="text-sm text-gray-600">
                  新しいパスワードでログインしてください。
                </p>
              </div>
            ) : !canUpdate ? (
              <div className="text-center">
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-600">
                  {(error || RESET_LINK_ERROR_MESSAGE).split("\n").map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                  スマートフォンでは、再設定を開始したブラウザと同じブラウザで開くと成功しやすい場合があります。
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="inline-flex px-5 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
                >
                  再設定メールを送り直す
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-6">
                  新しいパスワードを入力してください。
                </p>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                    {error}
                    <div className="mt-3">
                      <Link href="/auth/forgot-password" className="font-semibold text-red-700 underline">
                        再設定メールを送り直す
                      </Link>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Lock className="w-4 h-4 inline mr-1" />
                      新しいパスワード
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="8文字以上"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      minLength={8}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Lock className="w-4 h-4 inline mr-1" />
                      新しいパスワード確認
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="もう一度入力"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      minLength={8}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        更新中...
                      </span>
                    ) : (
                      "パスワードを更新"
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
