"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { INPUT_LIMITS } from "@/lib/input-limits";

export default function InquiryReplyForm({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (sending || !message.trim()) return;

    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/profile/inquiry-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId, message }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "送信に失敗しました");

      setMessage("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-gray-900">追加メッセージ</h2>
      <p className="mt-1 text-xs font-bold text-gray-500">
        このお問い合わせについて、追加情報や返信を運営へ送れます。
      </p>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={INPUT_LIMITS.contactContentMax}
        rows={5}
        className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder="追加で伝えたい内容を入力"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-gray-400">
          {message.length}/{INPUT_LIMITS.contactContentMax}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={sending || !message.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm transition-all disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "送信中..." : "送信する"}
        </button>
      </div>
    </section>
  );
}
