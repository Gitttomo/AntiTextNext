import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-utils";

const allowedPeriods = new Set(["month", "week", "day", "hour"]);

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const center = searchParams.get("center");

    if (!allowedPeriods.has(period)) {
      return NextResponse.json({ error: "不正な集計単位です" }, { status: 400 });
    }

    const { data, error } = await (supabase as any).rpc("admin_get_access_buckets", {
      target_period: period,
      center_start: center || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "アクセス集計を取得できませんでした" }, { status: 500 });
  }
}
