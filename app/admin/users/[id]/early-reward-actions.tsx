"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EarlyRewardActions({
  userId,
  initialOverride,
  initialNote,
}: {
  userId: string;
  initialOverride?: string | null;
  initialNote?: string | null;
}) {
  const router = useRouter();
  const [override, setOverride] = useState(initialOverride || "auto");
  const [note, setNote] = useState(initialNote || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, earlyRegistrationOverride: override, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "更新に失敗しました");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">早期登録フレーム</h2>
      <p className="mt-1 text-xs font-bold text-slate-500">全体設定に加えて、このユーザーだけ個別に透き通ったフレームを適用/除外できます。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
        <label className="space-y-2">
          <span className="text-xs font-black text-slate-500">個別設定</span>
          <select value={override} onChange={(event) => setOverride(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="auto">全体設定に従う</option>
            <option value="force_on">個別に適用する</option>
            <option value="force_off">個別に適用しない</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-xs font-black text-slate-500">メモ</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" placeholder="理由や対応メモ" />
        </label>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={saving} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
        早期フレーム設定を保存
      </button>
    </section>
  );
}
