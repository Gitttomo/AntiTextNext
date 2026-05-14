import { AdminPageHeader } from "../_components/admin-shell";
import { requireAdmin } from "@/lib/admin-utils";
import { AccessGraph, type AccessBucket } from "./access-graph";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await (supabase as any).rpc("admin_get_access_buckets", {
    target_period: "month",
    center_start: null,
  });
  const rows = ((data ?? []) as AccessBucket[]).map(row => ({
    ...row,
    visitor_count: Number(row.visitor_count ?? 0),
    is_future: Boolean(row.is_future),
  }));

  return (
    <>
      <AdminPageHeader
        title="アクセス分析"
        description="同じブラウザまたはログインユーザーを重複カウントしないユニーク訪問者数です。管理画面とAPIアクセスは除外しています。"
      />
      <main className="space-y-6 p-6">
        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            アクセス集計用SQLが未適用の可能性があります。migrationを適用してください。
          </div>
        )}

        <AccessGraph initialRows={rows} />
      </main>
    </>
  );
}
