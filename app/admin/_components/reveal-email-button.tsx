"use client";

import { useState } from "react";

export function RevealEmailButton({ userId, maskedEmail }: { userId: string; maskedEmail: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reveal = async () => {
    const reason = window.prompt("メールアドレス全文を表示する理由を入力してください。");
    if (!reason) return;

    const confirmed = window.confirm("個人情報を表示します。この操作は管理者ログに記録されます。続行しますか？");
    if (!confirmed) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/reveal-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "メールアドレスを取得できませんでした");
      setEmail(json.email);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="font-mono text-sm font-bold">{email ?? maskedEmail}</div>
      {!email && (
        <button
          type="button"
          onClick={reveal}
          disabled={loading}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          {loading ? "取得中..." : "メールアドレスを表示"}
        </button>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
