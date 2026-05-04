import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../../_components/admin-shell";
import { RevealChatButton } from "../../_components/reveal-chat-button";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminTransactionDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const { data: tx, error } = await (supabase as any)
    .from("transactions")
    .select("*, items(id,title,status,front_image_url), ratings(*)")
    .eq("id", params.id)
    .single();

  return (
    <>
      <AdminPageHeader title="取引詳細" description="チャット全文は初期表示しません。必要時のみ理由を記録して表示します。" />
      <main className="space-y-6 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        {tx && (
          <>
            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
              <Field label="商品" value={tx.items?.title ?? tx.item_id} />
              <Field label="取引ステータス" value={<StatusBadge value={tx.status} />} />
              <Field label="出品者" value={<Link className="text-primary" href={`/admin/users/${tx.seller_id}`}>{tx.seller_id}</Link>} />
              <Field label="購入者" value={<Link className="text-primary" href={`/admin/users/${tx.buyer_id}`}>{tx.buyer_id}</Link>} />
              <Field label="購入日時" value={formatAdminDate(tx.created_at)} />
              <Field label="受け渡し日時" value={`${tx.final_meetup_time || "未確定"} / ${tx.final_meetup_location || "-"}`} />
              <Field label="候補日時" value={(tx.meetup_time_slots ?? []).join(", ") || "-"} />
              <Field label="候補場所" value={(tx.meetup_locations ?? []).join(", ") || "-"} />
              <Field label="キャンセル理由" value={tx.cancellation_reason || "-"} />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-black">取引チャット</h2>
              <RevealChatButton transactionId={tx.id} />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-black text-slate-500">{label}</p>
      <div className="text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
