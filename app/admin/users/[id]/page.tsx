import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../../_components/admin-shell";
import { RevealEmailButton } from "../../_components/reveal-email-button";
import { formatAdminDate, maskEmail, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireAdmin();
  const userId = params.id;

  const [profileResult, listResult, itemsResult, buyerTxResult, sellerTxResult, ratingsResult, reportsAgainstResult, reportsByResult, restrictionsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    (supabase as any).rpc("admin_list_users", { search_text: userId, ban_filter: null }),
    supabase.from("items").select("id, title, status, created_at, front_image_url").eq("seller_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("transactions").select("id, item_id, status, created_at").eq("buyer_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("transactions").select("id, item_id, status, created_at").eq("seller_id", userId).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("ratings").select("*").or(`rater_id.eq.${userId},rated_id.eq.${userId}`).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("reports").select("*").eq("reported_user_id", userId).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("reports").select("*").eq("reporter_id", userId).order("created_at", { ascending: false }).limit(20),
    (supabase as any).from("user_restrictions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  const profile = profileResult.data as any;
  const userSummary = ((listResult.data ?? []) as any[]).find((user) => user.user_id === userId);
  const maskedEmail = userSummary?.masked_email ?? maskEmail(null);

  return (
    <>
      <AdminPageHeader title="ユーザー詳細" description="大学メールアドレスは理由付き操作でのみ全文表示できます。" />
      <main className="space-y-6 p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start">
            {profile?.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.nickname} width={96} height={96} className="h-24 w-24 rounded-2xl object-cover" />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-slate-200" />
            )}
            <div className="grid flex-1 gap-4 md:grid-cols-2">
              <Field label="ユーザーネーム" value={profile?.nickname ?? "-"} />
              <Field label="アカウントID" value={userId} mono />
              <Field label="学院・課程・学年・系" value={[profile?.department, profile?.degree, profile?.grade ? `${profile.grade}年` : null, profile?.major].filter(Boolean).join(" / ") || "-"} />
              <Field label="登録日" value={formatAdminDate(profile?.created_at)} />
              <div>
                <p className="mb-1 text-xs font-black text-slate-500">大学メールアドレス</p>
                <RevealEmailButton userId={userId} maskedEmail={maskedEmail} />
              </div>
              <div>
                <p className="mb-1 text-xs font-black text-slate-500">BAN/制限状態</p>
                <StatusBadge value={userSummary?.restriction_status} />
              </div>
            </div>
          </div>
        </section>

        <Grid>
          <List title="出品一覧" rows={(itemsResult.data ?? []).map((item: any) => ({ href: `/admin/items?item=${item.id}`, title: item.title, meta: `${item.status} / ${formatAdminDate(item.created_at)}` }))} />
          <List title="購入履歴" rows={(buyerTxResult.data ?? []).map((tx: any) => ({ href: `/admin/transactions/${tx.id}`, title: tx.id, meta: `${tx.status} / ${formatAdminDate(tx.created_at)}` }))} />
          <List title="出品側取引履歴" rows={(sellerTxResult.data ?? []).map((tx: any) => ({ href: `/admin/transactions/${tx.id}`, title: tx.id, meta: `${tx.status} / ${formatAdminDate(tx.created_at)}` }))} />
          <List title="評価・コメント" rows={((ratingsResult.data ?? []) as any[]).map((rating) => ({ title: `${rating.rating ?? "-"} / ${rating.comment ?? ""}`, meta: formatAdminDate(rating.created_at) }))} />
          <List title="通報された履歴" rows={((reportsAgainstResult.data ?? []) as any[]).map((report) => ({ href: `/admin/reports/${report.id}`, title: report.reason, meta: `${report.status} / ${formatAdminDate(report.created_at)}` }))} />
          <List title="通報した履歴" rows={((reportsByResult.data ?? []) as any[]).map((report) => ({ href: `/admin/reports/${report.id}`, title: report.reason, meta: `${report.status} / ${formatAdminDate(report.created_at)}` }))} />
          <List title="BAN/制限履歴" rows={((restrictionsResult.data ?? []) as any[]).map((r) => ({ title: r.restriction_type, meta: `${r.reason} / ${formatAdminDate(r.created_at)}` }))} />
        </Grid>
      </main>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-black text-slate-500">{label}</p>
      <p className={`text-sm font-bold text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-5 xl:grid-cols-2">{children}</section>;
}

function List({ title, rows }: { title: string; rows: Array<{ title: string; meta: string; href?: string }> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const content = (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="truncate text-sm font-black">{row.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{row.meta}</p>
            </div>
          );
          return row.href ? <Link key={`${row.title}-${index}`} href={row.href}>{content}</Link> : <div key={`${row.title}-${index}`}>{content}</div>;
        })}
        {rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">データがありません</p>}
      </div>
    </div>
  );
}
