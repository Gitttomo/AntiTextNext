import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../../_components/admin-shell";
import { AdminUserLink } from "../../_components/admin-user-link";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";
import { getItemImageUrl } from "@/lib/image-storage";
import AdminItemActions from "./item-actions";

export const dynamic = "force-dynamic";

export default async function AdminItemDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const { id } = params;

  const [{ data: item, error }, { data: reports }, { data: transactions }, { data: flags }] = await Promise.all([
    (supabase as any)
      .from("items")
      .select("id,title,original_price,selling_price,status,seller_id,created_at,front_image_url,back_image_url,front_thumbnail_url,back_thumbnail_url,front_image_storage_path,back_image_storage_path,front_thumbnail_storage_path,back_thumbnail_storage_path,image_storage_provider,moderation_status,moderation_note,hidden_at,deleted_at")
      .eq("id", id)
      .maybeSingle(),
    (supabase as any).from("reports").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("transactions").select("id,status,buyer_id,seller_id,created_at,completed_at,cancelled_at").eq("item_id", id).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("item_moderation_flags").select("*").eq("item_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  const userIds = Array.from(new Set([item?.seller_id, ...((transactions ?? []) as any[]).flatMap((tx) => [tx.buyer_id, tx.seller_id])].filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id,nickname").in("user_id", userIds)
    : { data: [] };
  const profileMap = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile.nickname]));

  const frontUrl = item ? getItemImageUrl(item, "front", "detail") : null;
  const backUrl = item ? getItemImageUrl(item, "back", "detail") : null;
  const activeTransactionCount = ((transactions ?? []) as any[]).filter((tx) =>
    ["pending_approval", "pending", "confirmed", "awaiting_rating"].includes(tx.status)
  ).length;

  return (
    <>
      <AdminPageHeader title="出品詳細" description="管理者操作は理由付きで admin_action_logs に記録されます。" />
      <main className="space-y-6 p-6">
        <Link href="/admin/items" className="inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-300">
          出品管理へ戻る
        </Link>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        {!item && !error && <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-600">出品が見つかりません</div>}

        {item && (
          <>
            <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[280px_1fr]">
              <div className="grid grid-cols-2 gap-3">
                <PreviewImage src={frontUrl} label="表紙" />
                <PreviewImage src={backUrl} label="裏表紙" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="タイトル" value={item.title} />
                <Field label="出品ID" value={item.id} mono />
                <Field label="出品者" value={<AdminUserLink id={item.seller_id} name={profileMap.get(item.seller_id) as string | undefined} />} />
                <Field label="出品日時" value={formatAdminDate(item.created_at)} />
                <Field label="価格" value={`定価 ${item.original_price ?? "-"}円 / 販売 ${item.selling_price ?? "-"}円`} />
                <Field label="状態" value={<StatusBadge value={item.status} />} />
                <Field label="画像保存先" value={item.image_storage_provider || "supabase"} />
                <Field label="モデレーション状態" value={<StatusBadge value={item.moderation_status || "visible"} />} />
                <Field className="md:col-span-2" label="管理者メモ" value={item.moderation_note || "-"} />
                <Field label="非公開日時" value={formatAdminDate(item.hidden_at)} />
                <Field label="削除日時" value={formatAdminDate(item.deleted_at)} />
              </div>
            </section>

            <AdminItemActions itemId={item.id} currentStatus={item.status} activeTransactionCount={activeTransactionCount} />

            <section className="grid gap-6 lg:grid-cols-2">
              <List
                title="関連取引"
                rows={((transactions ?? []) as any[]).map((tx) => ({
                  href: `/admin/transactions/${tx.id}`,
                  title: tx.id,
                  meta: `${tx.status} / ${formatAdminDate(tx.created_at)}`,
                }))}
              />
              <List
                title="関連通報"
                rows={((reports ?? []) as any[]).map((report) => ({
                  href: `/admin/reports/${report.id}`,
                  title: report.reason,
                  meta: `${report.status} / ${formatAdminDate(report.created_at)}`,
                }))}
              />
              <List
                title="管理フラグ"
                rows={((flags ?? []) as any[]).map((flag) => ({
                  title: flag.flag_type,
                  meta: `${flag.status} / ${flag.note || "-"} / ${formatAdminDate(flag.created_at)}`,
                }))}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function PreviewImage({ src, label }: { src?: string | null; label: string }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black text-slate-500">{label}</p>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {src ? <Image src={src} alt={label} fill sizes="280px" className="object-cover" /> : null}
      </div>
    </div>
  );
}

function Field({ label, value, mono, className = "" }: { label: string; value: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-black text-slate-500">{label}</p>
      <div className={`text-sm font-bold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: Array<{ title: string; meta?: string; href?: string }> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-black text-slate-900">{title}</h2>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const content = (
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-black text-slate-900">{row.title}</p>
                {row.meta && <p className="mt-1 text-xs font-bold text-slate-500">{row.meta}</p>}
              </div>
            );
            return row.href ? <Link key={`${row.title}-${index}`} href={row.href}>{content}</Link> : <div key={`${row.title}-${index}`}>{content}</div>;
          })}
        </div>
      ) : (
        <p className="text-sm font-bold text-slate-500">なし</p>
      )}
    </section>
  );
}
