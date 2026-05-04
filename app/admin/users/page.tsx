import Image from "next/image";
import Link from "next/link";
import { AdminPageHeader, StatusBadge } from "../_components/admin-shell";
import { formatAdminDate, getStringParam, maskEmail, requireAdmin, type AdminSearchParams } from "@/lib/admin-utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: AdminSearchParams }) {
  const { supabase } = await requireAdmin();
  const q = getStringParam(searchParams, "q");
  const restriction = getStringParam(searchParams, "restriction");
  const { data, error } = await (supabase as any).rpc("admin_list_users", {
    search_text: q || null,
    ban_filter: restriction || null,
  });

  let users = (data ?? []) as any[];
  let pageError = error?.message ?? "";

  if (error) {
    let fallbackQuery = supabase
      .from("profiles")
      .select("user_id, nickname, avatar_url, department, degree, grade, major, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (q) {
      fallbackQuery = fallbackQuery.or(`nickname.ilike.%${q}%,department.ilike.%${q}%,degree.ilike.%${q}%,major.ilike.%${q}%,user_id.ilike.%${q}%`);
    }

    const fallback = await fallbackQuery;
    if (!fallback.error) {
      users = ((fallback.data ?? []) as any[]).map((profile) => ({
        ...profile,
        masked_email: maskEmail(null),
        last_sign_in_at: null,
        transaction_count: "-",
        report_count: "-",
        restriction_status: "unknown",
      }));
      pageError = "admin_list_users RPC が未適用のため、メール・最終ログイン・通報/制限集計なしの fallback 表示です。migration を適用してください。";
    }
  }

  return (
    <>
      <AdminPageHeader title="ユーザー管理" description="個人情報は初期状態でマスキングしています。全文表示は詳細画面から理由付きで記録されます。" />
      <main className="space-y-5 p-6">
        <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_180px_auto]">
          <input name="q" defaultValue={q} placeholder="ユーザーネーム・メール・ID・学院・課程・学年・系で検索" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold" />
          <select name="restriction" defaultValue={restriction} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold">
            <option value="">すべて</option>
            <option value="restricted">BAN/制限中</option>
            <option value="none">制限なし</option>
          </select>
          <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white">検索</button>
        </form>

        {pageError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{pageError}</div>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">ユーザー</th>
                <th className="px-4 py-3">学院・課程・学年・系</th>
                <th className="px-4 py-3">大学メール</th>
                <th className="px-4 py-3">登録日</th>
                <th className="px-4 py-3">最終ログイン</th>
                <th className="px-4 py-3">取引</th>
                <th className="px-4 py-3">通報</th>
                <th className="px-4 py-3">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${user.user_id}`} className="flex items-center gap-3 font-black text-slate-900 hover:text-primary">
                      <Avatar src={user.avatar_url} alt={user.nickname} />
                      <span>{user.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-600">{[user.department, user.degree, user.grade ? `${user.grade}年` : null, user.major].filter(Boolean).join(" / ")}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-600">{user.masked_email}</td>
                  <td className="px-4 py-3 font-bold text-slate-600">{formatAdminDate(user.created_at)}</td>
                  <td className="px-4 py-3 font-bold text-slate-600">{formatAdminDate(user.last_sign_in_at)}</td>
                  <td className="px-4 py-3 font-black">{user.transaction_count}</td>
                  <td className="px-4 py-3 font-black">{user.report_count}</td>
                  <td className="px-4 py-3"><StatusBadge value={user.restriction_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-10 text-center text-sm font-bold text-slate-500">該当するユーザーがいません</div>}
        </div>
      </main>
    </>
  );
}

function Avatar({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return <div className="h-10 w-10 rounded-full bg-slate-200" />;
  return <Image src={src} alt={alt} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />;
}
