import { AdminPageHeader } from "../_components/admin-shell";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await (supabase as any).from("admin_action_logs").select("*").order("created_at", { ascending: false }).limit(300);

  return (
    <>
      <AdminPageHeader title="管理者操作ログ" description="個人情報閲覧、チャット閲覧、BAN、非公開化などの監査ログです。" />
      <main className="space-y-5 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>{["日時", "管理者", "操作", "対象", "対象ID", "理由", "metadata"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((data ?? []) as any[]).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold">{formatAdminDate(log.created_at)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{log.admin_user_id?.slice(0, 8) || "-"}</td>
                  <td className="px-4 py-3 font-black">{log.action_type}</td>
                  <td className="px-4 py-3 font-bold">{log.target_type}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{log.target_id}</td>
                  <td className="px-4 py-3 font-bold">{log.reason || "-"}</td>
                  <td className="max-w-sm truncate px-4 py-3 font-mono text-xs">{JSON.stringify(log.metadata ?? {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
