import { AdminPageHeader } from "../_components/admin-shell";
import { requireAdmin } from "@/lib/admin-utils";
import RewardActions from "./reward-actions";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const { supabase } = await requireAdmin();
  const { data: setting } = await (supabase as any).from("reward_settings").select("*").eq("id", "early_registration").single();

  return (
    <>
      <AdminPageHeader title="特典付与" description="ベータ版公開期間のアイコン枠と自動付与設定を管理します。個別バッジは各ユーザー詳細から付与します。" />
      <main className="space-y-6 p-6">
        <RewardActions
          initialEnabled={Boolean(setting?.enabled)}
          initialStartsAt={setting?.starts_at}
          initialEndsAt={setting?.ends_at}
        />

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
          <Info title="早期登録" text="設定期間内の登録でクリスタル風フレーム" />
          <Info title="出品数 0" text="白フレーム" />
          <Info title="出品数 1/5/10/20" text="黄 / 緑 / 薄青 / 紺" />
          <Info title="バッジ" text="ユーザー管理 > ユーザー詳細で付与" />
        </section>
      </main>
    </>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{text}</p>
    </div>
  );
}
