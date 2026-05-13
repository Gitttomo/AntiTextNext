import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-utils";

export async function POST(request: NextRequest) {
  try {
    const { userId, reason } = await request.json();
    if (!userId || !reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "閲覧理由が必要です" }, { status: 400 });
    }

    const { supabase } = await requireAdmin();
    const { data, error } = await (supabase as any).rpc("admin_get_user_email", {
      target_user_id: userId,
      reason,
    });

    if (error) throw error;
    return NextResponse.json({ email: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "メールアドレスを取得できませんでした" }, { status: 500 });
  }
}
