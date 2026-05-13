"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RewardActions({
  initialEnabled,
  initialStartsAt,
  initialEndsAt,
}: {
  initialEnabled: boolean;
  initialStartsAt?: string | null;
  initialEndsAt?: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [startsAt, setStartsAt] = useState(toLocalInputValue(initialStartsAt));
  const [endsAt, setEndsAt] = useState(toLocalInputValue(initialEndsAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveSetting = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        }),
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
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">早期登録特典</h2>
        <p className="mt-1 text-xs font-bold text-slate-500">有効期間内に登録したユーザーのアイコン枠をクリスタル風にします。</p>
        <label className="mt-4 flex items-center gap-3 text-sm font-black">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-5 w-5" />
          自動付与を有効にする
        </label>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-500">開始日時</span>
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-500">終了日時</span>
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          </label>
        </div>
        <button onClick={saveSetting} disabled={saving} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
          設定を保存
        </button>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
