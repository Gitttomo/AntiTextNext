import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminRestrictionsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await (supabase as any).from("user_restrictions").select("*").order("created_at", { ascending: false }).limit(200);

  return (
    <>
      <AdminPageHeader title="BAN・制限管理" description="警告、一時停止、永久BANを記録します。主要操作の実制限は各機能側で user_restrictions を確認して拡張してください。" />
      <main className="space-y-5 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-black">制限の種類</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Info title="警告" text="記録とユーザー向け通知文を残す軽い措置です。" />
            <Info title="一時停止" text="期間付きで出品・購入・チャット停止に拡張できます。" />
            <Info title="永久BAN" text="危険操作です。解除も含めて admin 権限とログ記録が必要です。" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>{["対象ユーザー", "制限種別", "理由", "期間", "関連通報", "関連取引", "作成者", "状態"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((data ?? []) as any[]).map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link href={`/admin/users/${r.user_id}`} className="font-mono text-xs font-bold text-primary">{r.user_id}</Link></td>
                  <td className="px-4 py-3"><StatusBadge value={r.restriction_type} /></td>
                  <td className="px-4 py-3 font-bold">{r.reason}</td>
                  <td className="px-4 py-3 font-bold">{formatAdminDate(r.starts_at)} - {formatAdminDate(r.ends_at)}</td>
                  <td className="px-4 py-3 font-bold">{r.related_report_id || "-"}</td>
                  <td className="px-4 py-3 font-bold">{r.related_transaction_id || "-"}</td>
                  <td className="px-4 py-3 font-bold">{r.created_by?.slice(0, 8) || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge value={r.lifted_at ? "解除済み" : "有効"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="font-black">{title}</p><p className="mt-2 text-sm font-medium text-slate-600">{text}</p></div>;
}
