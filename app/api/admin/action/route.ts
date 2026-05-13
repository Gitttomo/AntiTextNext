import { NextResponse, type NextRequest } from "next/server";
import { adminLog, requireAdmin } from "@/lib/admin-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { actionType, targetType, targetId, reason, metadata } = body;
    if (!actionType || !targetType || !targetId) {
      return NextResponse.json({ error: "操作情報が不足しています" }, { status: 400 });
    }

    const { supabase } = await requireAdmin();
    await adminLog(supabase, actionType, targetType, targetId, reason, metadata ?? {});
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "操作ログを記録できませんでした" }, { status: 500 });
  }
}
