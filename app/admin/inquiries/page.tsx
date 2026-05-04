import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { formatAdminDate, getStringParam, maskEmail, requireAdmin, type AdminSearchParams } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const { supabase } = await requireAdmin();
  const status = getStringParam(searchParams, "status");
  let query = (supabase as any).from("inquiries").select("*").order("updated_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;

  return (
    <>
      <AdminPageHeader title="問い合わせ管理" description="メールアドレスは一覧ではマスキングしています。対応履歴は操作ログに残してください。" />
      <main className="space-y-5 p-6">
        <form className="rounded-2xl border border-slate-200 bg-white p-4">
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="">すべて</option>
            <option value="open">未対応</option>
            <option value="checking">確認中</option>
            <option value="replied">返信済み</option>
            <option value="completed">対応完了</option>
            <option value="no_action">対応不要</option>
          </select>
          <button className="ml-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">絞り込み</button>
        </form>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>{["ID", "送信日時", "送信者", "メール", "種別", "内容", "状態", "担当者", "最終更新"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((data ?? []) as any[]).map((inq) => (
                <tr key={inq.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-black">{inq.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-bold">{formatAdminDate(inq.created_at)}</td>
                  <td className="px-4 py-3 font-bold">{inq.sender_name || inq.sender_user_id || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{maskEmail(inq.email)}</td>
                  <td className="px-4 py-3 font-bold">{inq.category}</td>
                  <td className="max-w-sm truncate px-4 py-3 font-bold">{inq.content}</td>
                  <td className="px-4 py-3"><StatusBadge value={inq.status} /></td>
                  <td className="px-4 py-3 font-bold">{inq.assignee_id?.slice(0, 8) || "-"}</td>
                  <td className="px-4 py-3 font-bold">{formatAdminDate(inq.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
