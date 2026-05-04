"use client";

import { useState } from "react";

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
};

export function RevealChatButton({ transactionId }: { transactionId: string }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reveal = async () => {
    const reason = window.prompt("チャット全文を確認する理由を入力してください。");
    if (!reason) return;
    if (!window.confirm("取引チャット全文を表示します。この操作は管理者ログに記録されます。続行しますか？")) return;

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/reveal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, reason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "チャットを取得できませんでした");
      setMessages(json.messages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (messages) {
    return (
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">
              {formatDate(message.created_at)} / {message.sender_id.slice(0, 8)} → {message.receiver_id.slice(0, 8)}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-slate-800">{message.message}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={reveal}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? "取得中..." : "チャット内容を確認する"}
      </button>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
