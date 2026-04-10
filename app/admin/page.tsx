import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Users, Package, ClipboardList, ArrowRight, AlertCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isCurrentUserAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type DashboardSummary = {
  totalUsers: number;
  totalItems: number;
  totalTransactions: number;
};

const statCards = (summary: DashboardSummary) => [
  {
    label: "登録ユーザー",
    value: summary.totalUsers,
    icon: Users,
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    label: "出品数",
    value: summary.totalItems,
    icon: Package,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    label: "取引数",
    value: summary.totalTransactions,
    icon: ClipboardList,
    tone: "bg-amber-50 text-amber-700 border-amber-100",
  },
];

export default async function AdminPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/auth/login?redirectTo=/admin");
  }

  const isAdmin = await isCurrentUserAdmin(supabase);

  if (!isAdmin) {
    redirect("/profile");
  }

  const [
    usersCountResult,
    itemsCountResult,
    transactionsCountResult,
    recentUsersResult,
    recentItemsResult,
    recentTransactionsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("transactions").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("user_id, nickname, department, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("items")
      .select("id, title, selling_price, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("transactions")
      .select("id, item_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const errors = [
    usersCountResult.error,
    itemsCountResult.error,
    transactionsCountResult.error,
    recentUsersResult.error,
    recentItemsResult.error,
    recentTransactionsResult.error,
  ].filter(Boolean);

  const summary: DashboardSummary = {
    totalUsers: usersCountResult.count ?? 0,
    totalItems: itemsCountResult.count ?? 0,
    totalTransactions: transactionsCountResult.count ?? 0,
  };

  const recentUsers = (recentUsersResult.data ?? []) as Array<{
    user_id: string;
    nickname: string;
    department: string;
    created_at: string;
  }>;

  const recentItems = (recentItemsResult.data ?? []) as Array<{
    id: string;
    title: string;
    selling_price: number;
    status: string;
    created_at: string;
  }>;

  const recentTransactions = (recentTransactionsResult.data ?? []) as Array<{
    id: string;
    item_id: string;
    status: string;
    created_at: string;
  }>;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur px-6 pt-10 pb-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-600">
            <Shield className="h-3.5 w-3.5" />
            Admin Console
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                管理ダッシュボード
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                ユーザー、出品、取引の状況をまとめて確認できます。
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-primary/30 hover:text-primary"
            >
              マイページへ戻る
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {errors.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              一部の集計を取得できませんでした。Supabase の RLS または権限設定を確認してください。
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {statCards(summary).map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className={`rounded-3xl border p-6 shadow-sm ${card.tone}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold">{card.label}</span>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black tracking-tight">
                  {card.value.toLocaleString()}
                </p>
              </div>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <DashboardPanel
            title="新規ユーザー"
            emptyLabel="ユーザー情報がありません"
            rows={recentUsers.map((user) => ({
              key: user.user_id,
              title: user.nickname,
              meta: user.department,
              submeta: formatDate(user.created_at),
            }))}
          />

          <DashboardPanel
            title="最新の出品"
            emptyLabel="出品情報がありません"
            rows={recentItems.map((item) => ({
              key: item.id,
              title: item.title,
              meta: `¥${item.selling_price.toLocaleString()}`,
              submeta: `${item.status} / ${formatDate(item.created_at)}`,
            }))}
          />

          <DashboardPanel
            title="最新の取引"
            emptyLabel="取引情報がありません"
            rows={recentTransactions.map((transaction) => ({
              key: transaction.id,
              title: `取引 ${transaction.id.slice(0, 8)}`,
              meta: transaction.status,
              submeta: formatDate(transaction.created_at),
            }))}
          />
        </section>
      </main>
    </div>
  );
}

function DashboardPanel({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{
    key: string;
    title: string;
    meta: string;
    submeta: string;
  }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
          {rows.length}件
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="truncate font-bold text-slate-900">{row.title}</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{row.meta}</p>
            <p className="mt-1 text-xs text-slate-500">{row.submeta}</p>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
