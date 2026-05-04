import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../../_components/admin-shell";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const { data: report, error } = await (supabase as any).from("reports").select("*").eq("id", params.id).single();

  return (
    <>
      <AdminPageHeader title="通報詳細" description="対応履歴は admin_action_logs と管理者メモで追跡します。" />
      <main className="space-y-6 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}
        {report && (
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
            <Field label="通報ID" value={report.id} />
            <Field label="状態" value={<StatusBadge value={report.status} />} />
            <Field label="通報者" value={report.reporter_id ? <Link className="text-primary" href={`/admin/users/${report.reporter_id}`}>{report.reporter_id}</Link> : "-"} />
            <Field label="通報されたユーザー" value={report.reported_user_id ? <Link className="text-primary" href={`/admin/users/${report.reported_user_id}`}>{report.reported_user_id}</Link> : "-"} />
            <Field label="対象出品" value={report.item_id || "-"} />
            <Field label="対象取引" value={report.transaction_id ? <Link className="text-primary" href={`/admin/transactions/${report.transaction_id}`}>{report.transaction_id}</Link> : "-"} />
            <Field label="理由" value={report.reason} />
            <Field label="通報内容" value={report.detail || "-"} />
            <Field label="管理者メモ" value={report.admin_note || "-"} />
            <Field label="作成/更新" value={`${formatAdminDate(report.created_at)} / ${formatAdminDate(report.updated_at)}`} />
          </section>
        )}
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="mb-1 text-xs font-black text-slate-500">{label}</p><div className="whitespace-pre-wrap text-sm font-bold text-slate-900">{value}</div></div>;
}
