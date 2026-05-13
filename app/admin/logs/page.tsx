import Link from "next/link";
import { AdminPageHeader } from "../_components/admin-shell";
import { AdminUserLink } from "../_components/admin-user-link";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await (supabase as any)
    .from("admin_action_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const logs = (data ?? []) as any[];
  const transactionLogs = logs.filter((log) => log.target_type === "transaction" && log.target_id);
  const otherLogs = logs.filter((log) => !(log.target_type === "transaction" && log.target_id));
  const transactionIds = Array.from(new Set(transactionLogs.map((log) => log.target_id)));

  const { data: transactions } = transactionIds.length
    ? await (supabase as any)
        .from("transactions")
        .select("id,seller_id,buyer_id,items(title)")
        .in("id", transactionIds)
    : { data: [] };

  const userIds = Array.from(
    new Set([
      ...((transactions ?? []) as any[]).flatMap((tx) => [tx.seller_id, tx.buyer_id]),
      ...logs.map((log) => log.admin_user_id),
    ].filter(Boolean))
  );
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("user_id,nickname").in("user_id", userIds)
    : { data: [] };

  const profileMap = new Map(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile.nickname]));
  const transactionMap = new Map(((transactions ?? []) as any[]).map((tx) => [tx.id, tx]));
  const groupedTransactionLogs = transactionLogs.reduce<Record<string, any[]>>((acc, log) => {
    acc[log.target_id] ||= [];
    acc[log.target_id].push(log);
    return acc;
  }, {});

  return (
    <>
      <AdminPageHeader title="管理者操作ログ" description="取引関連ログは取引ごとにまとめて表示します。" />
      <main className="space-y-6 p-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error.message}</div>}

        <section className="space-y-4">
          <h2 className="text-lg font-black text-slate-900">取引ごとのログ</h2>
          {Object.entries(groupedTransactionLogs).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">取引関連ログはありません。</p>
          ) : (
            Object.entries(groupedTransactionLogs).map(([transactionId, rows]) => {
              const transaction = transactionMap.get(transactionId);
              return (
                <section key={transactionId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <div>
                      <Link href={`/admin/transactions/${transactionId}`} className="text-base font-black text-primary hover:underline">
                        {formatTransactionLabel(transaction, profileMap)}
                      </Link>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-400">{transactionId}</p>
                    </div>
                    <p className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{rows.length}件</p>
                  </div>
                  <LogTable logs={rows} profileMap={profileMap} showTarget={false} />
                </section>
              );
            })
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-black text-slate-900">その他のログ</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <LogTable logs={otherLogs} profileMap={profileMap} showTarget />
          </div>
        </section>
      </main>
    </>
  );
}

function LogTable({
  logs,
  profileMap,
  showTarget,
}: {
  logs: any[];
  profileMap: Map<any, any>;
  showTarget: boolean;
}) {
  return (
    <table className="w-full min-w-[900px] text-left text-sm">
      <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
        <tr>
          {["日時", "管理者", "操作", ...(showTarget ? ["対象", "対象ID"] : []), "理由", "metadata"].map((header) => (
            <th key={header} className="px-4 py-3">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {logs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-bold">{formatAdminDate(log.created_at)}</td>
            <td className="px-4 py-3"><AdminUserLink id={log.admin_user_id} name={profileMap.get(log.admin_user_id) as string | undefined} /></td>
            <td className="px-4 py-3 font-black">{log.action_type}</td>
            {showTarget && (
              <>
                <td className="px-4 py-3 font-bold">{log.target_type}</td>
                <td className="px-4 py-3 font-mono text-xs font-bold">{log.target_id}</td>
              </>
            )}
            <td className="max-w-xs px-4 py-3 font-bold">{log.reason || "-"}</td>
            <td className="max-w-sm truncate px-4 py-3 font-mono text-xs">{JSON.stringify(log.metadata ?? {})}</td>
          </tr>
        ))}
        {logs.length === 0 && (
          <tr>
            <td className="px-4 py-8 text-center text-sm font-bold text-slate-500" colSpan={showTarget ? 7 : 5}>ログはありません。</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function formatTransactionLabel(transaction: any, profileMap: Map<any, any>) {
  if (!transaction) return "不明な取引";

  const title = truncateLabel(transaction.items?.title ?? "不明な出品", 7);
  const seller = truncateLabel(profileMap.get(transaction.seller_id) ?? transaction.seller_id ?? "-", 5);
  const buyer = truncateLabel(profileMap.get(transaction.buyer_id) ?? transaction.buyer_id ?? "-", 5);

  return `${title} / ${seller} / ${buyer}`;
}

function truncateLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
