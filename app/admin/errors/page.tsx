import { AdminPageHeader } from "../_components/admin-shell";

export const dynamic = "force-dynamic";

export default function AdminErrorsPage() {
  return (
    <>
      <AdminPageHeader title="エラー/ログ管理" description="現時点ではアプリ内エラーテーブルがないため、件数は 0 として扱っています。" />
      <main className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-bold text-slate-600">
            将来的には client/server error logs テーブル、または外部監視サービスのイベントをここに接続してください。
          </p>
        </div>
      </main>
    </>
  );
}
