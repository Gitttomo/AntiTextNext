"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeBadgeButton({ badgeId }: { badgeId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const revoke = async () => {
    if (saving) return;
    if (!confirm("このバッジを取り消しますか？")) return;

    setSaving(true);
    try {
      await fetch("/api/admin/rewards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ badgeId, reason: "ユーザー詳細からバッジ取り消し" }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button type="button" onClick={revoke} disabled={saving} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black text-red-600 disabled:opacity-50">
      取り消し
    </button>
  );
}
