import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { formatAdminDate, getStringParam, requireAdmin, type AdminSearchParams } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminItemsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const { supabase } = await requireAdmin();
  const q = getStringParam(searchParams, "q");
  const status = getStringParam(searchParams, "status");
  let query = (supabase as any)
    .from("items")
    .select("id, title, front_image_url, back_image_url, seller_id, created_at, status, transactions(id,status)");

  if (q) query = query.ilike("title", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  const itemIds = ((data ?? []) as any[]).map((item) => item.id);
  const sellerIds = Array.from(new Set(((data ?? []) as any[]).map((item) => item.seller_id).filter(Boolean)));
  const { data: reports } = itemIds.length
    ? await (supabase as any).from("reports").select("item_id").in("item_id", itemIds)
    : { data: [] };
  const { data: profiles } = sellerIds.length
    ? await supabase.from("profiles").select("user_id,nickname").in("user_id", sellerIds)
    : { data: [] };
  const reportedIds = new Set(((reports ?? []) as any[]).map((report) => report.item_id));
  const profileMap = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile.nickname]));

  return (
    <>
      <AdminPageHeader title="出品管理" description="非公開・削除などの危険操作はログ記録 API を通して実装する前提で、まず監視用一覧を提供します。" />
      <main className="space-y-5 p-6">
        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input name="q" defaultValue={q} placeholder="出品タイトルで検索" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="">すべて</option>
            <option value="available">出品中</option>
            <option value="transaction_pending">取引中</option>
            <option value="sold">完了</option>
          </select>
          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">検索</button>
        </form>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">出品</th>
                <th className="px-4 py-3">表紙</th>
                <th className="px-4 py-3">裏表紙</th>
                <th className="px-4 py-3">出品者</th>
                <th className="px-4 py-3">出品日時</th>
                <th className="px-4 py-3">状態</th>
                <th className="px-4 py-3">取引状態</th>
                <th className="px-4 py-3">通報</th>
                <th className="px-4 py-3">メモ/フラグ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((data ?? []) as any[]).map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black">{item.title}</td>
                  <td className="px-4 py-3"><Thumb src={item.front_image_url} /></td>
                  <td className="px-4 py-3"><Thumb src={item.back_image_url} /></td>
                  <td className="px-4 py-3"><Link href={`/admin/users/${item.seller_id}`} className="font-bold text-primary">{profileMap.get(item.seller_id) ?? item.seller_id.slice(0, 8)}</Link></td>
                  <td className="px-4 py-3 font-bold text-slate-600">{formatAdminDate(item.created_at)}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  <td className="px-4 py-3"><StatusBadge value={item.transactions?.[0]?.status ?? "未取引"} /></td>
                  <td className="px-4 py-3">{reportedIds.has(item.id) ? <StatusBadge value="通報あり" /> : "-"}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">migration適用後に利用可</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function Thumb({ src }: { src?: string | null }) {
  if (!src) return <div className="h-14 w-10 rounded-lg bg-slate-100" />;
  return <Image src={src} alt="" width={40} height={56} className="h-14 w-10 rounded-lg object-cover" />;
}
