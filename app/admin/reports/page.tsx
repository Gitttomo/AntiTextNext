import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { formatAdminDate, getStringParam, requireAdmin, type AdminSearchParams } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const { supabase } = await requireAdmin();
  const status = getStringParam(searchParams, "status");
  let query = (supabase as any).from("reports").select("*").order("updated_at", { ascending: false }).limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;

  return (
    <>
      <AdminPageHeader title="通報管理" description="ステータス変更、メモ、警告、制限、BAN は操作ログ記録を前提に管理します。" />
      <main className="space-y-5 p-6">
        <form className="rounded-2xl border border-slate-200 bg-white p-4">
          <select name="status" defaultValue={status} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="">すべて</option>
            <option value="open">未対応</option>
            <option value="checking">確認中</option>
            <option value="warned">警告済み</option>
            <option value="restricted">一時制限済み</option>
            <option value="banned">BAN済み</option>
            <option value="no_action">対応不要</option>
            <option value="completed">完了</option>
          </select>
          <button className="ml-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">絞り込み</button>
        </form>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        <AdminTable
          rows={((data ?? []) as any[]).map((report) => [
            <Link key="id" href={`/admin/reports/${report.id}`} className="font-mono text-xs font-black text-primary">{report.id}</Link>,
            formatAdminDate(report.created_at),
            userLink(report.reporter_id),
            userLink(report.reported_user_id),
            report.item_id || "-",
            report.transaction_id || "-",
            report.reason,
            <StatusBadge key="status" value={report.status} />,
            report.assignee_id ? userLink(report.assignee_id) : "-",
            formatAdminDate(report.updated_at),
          ])}
          headers={["通報ID", "通報日時", "通報者", "通報されたユーザー", "対象出品", "対象取引", "理由", "状態", "担当者", "最終更新"]}
        />
      </main>
    </>
  );
}

function userLink(id?: string | null) {
  return id ? <Link href={`/admin/users/${id}`} className="font-mono text-xs font-bold text-primary">{id.slice(0, 8)}</Link> : "-";
}

function AdminTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => <tr key={index} className="hover:bg-slate-50">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 font-bold text-slate-700">{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
