import Link from "next/link";
import { Activity, Ban, ClipboardList, FileWarning, Inbox, Package, Users } from "lucide-react";
import { AdminPageHeader, StatusBadge } from "./_components/admin-shell";
import { formatAdminDate, requireAdmin } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

const cards = [
  { key: "users", label: "登録ユーザー数", href: "/admin/users", icon: Users, tone: "border-blue-100 bg-blue-50 text-blue-700" },
  { key: "items", label: "出品数", href: "/admin/items", icon: Package, tone: "border-emerald-100 bg-emerald-50 text-emerald-700" },
  { key: "activeTransactions", label: "取引中の件数", href: "/admin/transactions?status=active", icon: ClipboardList, tone: "border-amber-100 bg-amber-50 text-amber-700" },
  { key: "completedTransactions", label: "完了取引数", href: "/admin/transactions?status=completed", icon: ClipboardList, tone: "border-violet-100 bg-violet-50 text-violet-700" },
  { key: "reports", label: "通報件数", href: "/admin/reports", icon: FileWarning, tone: "border-red-100 bg-red-50 text-red-700" },
  { key: "openInquiries", label: "未対応のお問い合わせ数", href: "/admin/inquiries?status=open", icon: Inbox, tone: "border-cyan-100 bg-cyan-50 text-cyan-700" },
  { key: "restrictedUsers", label: "BAN中のユーザー数", href: "/admin/users?restriction=restricted", icon: Ban, tone: "border-rose-100 bg-rose-50 text-rose-700" },
  { key: "errors", label: "エラー件数", href: "/admin/errors", icon: Activity, tone: "border-slate-200 bg-slate-100 text-slate-700" },
];

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const now = new Date().toISOString();

  const [
    users,
    items,
    activeTransactions,
    completedTransactions,
    reports,
    openInquiries,
    restrictedUsers,
    recentUsers,
    recentReports,
    recentInquiries,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed", "awaiting_rating"]),
    supabase.from("transactions").select("*", { count: "exact", head: true }).eq("status", "completed"),
    (supabase as any).from("reports").select("*", { count: "exact", head: true }),
    (supabase as any).from("inquiries").select("*", { count: "exact", head: true }).in("status", ["open", "checking"]),
    (supabase as any).from("user_restrictions").select("*", { count: "exact", head: true }).is("lifted_at", null).or(`ends_at.is.null,ends_at.gt.${now}`),
    supabase.from("profiles").select("user_id, nickname, department, created_at").order("created_at", { ascending: false }).limit(5),
    (supabase as any).from("reports").select("id, reason, status, created_at").order("created_at", { ascending: false }).limit(5),
    (supabase as any).from("inquiries").select("id, sender_name, category, status, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const counts: Record<string, number> = {
    users: users.count ?? 0,
    items: items.count ?? 0,
    activeTransactions: activeTransactions.count ?? 0,
    completedTransactions: completedTransactions.count ?? 0,
    reports: reports.count ?? 0,
    openInquiries: openInquiries.count ?? 0,
    restrictedUsers: restrictedUsers.count ?? 0,
    errors: 0,
  };

  return (
    <>
      <AdminPageHeader title="管理者ダッシュボード" description="運営対応に必要な件数と最近の動きを確認します。" />
      <main className="space-y-8 p-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.key} href={card.href} className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-black">{card.label}</span>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black">{counts[card.key].toLocaleString()}</p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Panel title="最近登録したユーザー">
            {(recentUsers.data ?? []).map((user: any) => (
              <Row key={user.user_id} title={user.nickname} meta={user.department} sub={formatAdminDate(user.created_at)} />
            ))}
          </Panel>
          <Panel title="最近の通報">
            {((recentReports.data ?? []) as any[]).map((report) => (
              <Row key={report.id} title={report.reason} meta={<StatusBadge value={report.status} />} sub={formatAdminDate(report.created_at)} />
            ))}
          </Panel>
          <Panel title="最近の問い合わせ">
            {((recentInquiries.data ?? []) as any[]).map((inquiry) => (
              <Row key={inquiry.id} title={inquiry.sender_name || "匿名"} meta={`${inquiry.category} / ${inquiry.status}`} sub={formatAdminDate(inquiry.created_at)} />
            ))}
          </Panel>
        </section>
      </main>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ title, meta, sub }: { title: string; meta: React.ReactNode; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="truncate text-sm font-black">{title}</p>
      <div className="mt-1 text-xs font-bold text-slate-600">{meta}</div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
