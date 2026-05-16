import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { AdminUserLink } from "../_components/admin-user-link";
import { formatAdminDate, getStringParam, maskEmail, requireAdmin, type AdminSearchParams } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const { supabase } = await requireAdmin();
  const status = getStringParam(searchParams, "status");
  let query = (supabase as any).from("inquiries").select("*").order("updated_at", { ascending: false }).limit(200);
  if (status === "unresolved") {
    query = query.neq("status", "completed").neq("status", "no_action");
  } else if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  const userIds = Array.from(
    new Set(((data ?? []) as any[]).flatMap((inquiry) => [inquiry.sender_user_id, inquiry.assignee_id]).filter(Boolean))
  );
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("user_id,nickname").in("user_id", userIds) : { data: [] };
  const profileMap = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile.nickname]));

  return (
    <>
      <AdminPageHeader title="問い合わせ管理" description="メールアドレスは一覧ではマスキングしています。対応履歴は操作ログに残してください。" />
      <main className="space-y-5 p-6">
        <form className="rounded-2xl border border-slate-200 bg-white p-4">
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="">すべて</option>
            <option value="unresolved">未対応（完了以外）</option>
            <option value="open">未対応（新規）</option>
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
              <tr>{["ID", "通知", "送信日時", "送信者", "メール", "種別", "内容", "状態", "担当者", "最終更新"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((data ?? []) as any[]).map((inq) => (
                <tr key={inq.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-black">
                    <Link className="text-primary hover:underline" href={`/admin/inquiries/${inq.id}`}>{inq.id.slice(0, 8)}</Link>
                  </td>
                  <td className="px-4 py-3">
                    {inq.has_unread_user_message ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-black text-red-600 ring-1 ring-red-100">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        返信あり
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold">{formatAdminDate(inq.created_at)}</td>
                  <td className="px-4 py-3 font-bold">
                    {inq.sender_user_id ? <AdminUserLink id={inq.sender_user_id} name={profileMap.get(inq.sender_user_id) as string | undefined} /> : inq.sender_name || "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{maskEmail(inq.email)}</td>
                  <td className="px-4 py-3 font-bold">{inq.category}</td>
                  <td className="max-w-sm truncate px-4 py-3 font-bold">
                    <Link className="hover:text-primary hover:underline" href={`/admin/inquiries/${inq.id}`}>{inq.content}</Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={inq.status} /></td>
                  <td className="px-4 py-3 font-bold"><AdminUserLink id={inq.assignee_id} name={profileMap.get(inq.assignee_id) as string | undefined} /></td>
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
