"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statusOptions = [
  { value: "open", label: "未対応" },
  { value: "checking", label: "確認中" },
  { value: "replied", label: "返信済み" },
  { value: "completed", label: "対応完了" },
  { value: "no_action", label: "対応不要" },
];

const defaultReplyMessage =
  "いつもTextNextをご利用いただきありがとうございます。\n\n" +
  "この度はお問い合わせいただき、ありがとうございました。\n" +
  "お問い合わせ内容を確認し、以下の通り対応いたしました。\n\n" +
  "【対応内容】\n" +
  "こちらに対応内容を記入してください。\n\n" +
  "ご不明な点や解決していない点がございましたら、お手数ですが再度お問い合わせよりご連絡ください。\n" +
  "今後ともTextNextをよろしくお願いいたします。";

export default function InquiryActions({
  inquiryId,
  initialStatus,
  initialAdminNote,
  senderUserId,
}: {
  inquiryId: string;
  initialStatus: string;
  initialAdminNote?: string | null;
  senderUserId?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [adminNote, setAdminNote] = useState(initialAdminNote ?? "");
  const [message, setMessage] = useState(defaultReplyMessage);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const save = async (nextStatus?: string) => {
    if (saving) return;
    const statusToSave = nextStatus ?? status;
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/inquiry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryId,
          status: statusToSave,
          adminNote,
          reason: statusToSave === "completed" ? "問い合わせを対応完了に変更" : `問い合わせステータスを ${statusToSave} に変更`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "更新に失敗しました");

      setStatus(statusToSave);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const sendMessage = async () => {
    if (sending || !message.trim()) return;
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/admin/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId, message }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "送信に失敗しました");

      setMessage(defaultReplyMessage);
      if (status !== "completed") setStatus("replied");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">対応操作</h2>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <label className="space-y-2">
          <span className="text-xs font-black text-slate-500">ステータス</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-black text-slate-500">管理者メモ</span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold"
            placeholder="対応内容や判断理由を残してください"
          />
        </label>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          保存する
        </button>
        <button
          type="button"
          onClick={() => save(status === "completed" ? "checking" : "completed")}
          disabled={saving}
          className={`rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50 ${status === "completed" ? "bg-amber-600" : "bg-emerald-600"}`}
        >
          {status === "completed" ? "対応完了を取り消す" : "対応完了にする"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <h3 className="text-sm font-black text-slate-900">送信者のお知らせへメッセージ</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {senderUserId ? "送信すると相手のお知らせに未読通知として表示されます。" : "送信者ユーザーIDがない問い合わせには送信できません。"}
        </p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          disabled={!senderUserId}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold disabled:bg-slate-100"
          placeholder="ユーザーへ送る内容を入力"
        />
        <button
          type="button"
          onClick={sendMessage}
          disabled={sending || !senderUserId || !message.trim()}
          className="mt-3 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {sending ? "送信中..." : "お知らせに送信する"}
        </button>
      </div>
    </section>
  );
}
