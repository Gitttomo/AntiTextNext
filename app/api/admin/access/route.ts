import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-utils";

const allowedPeriods = new Set(["month", "week", "day", "hour"]);
type AccessPeriod = "month" | "week" | "day" | "hour";

const jstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toJstDateKey = (value: string | Date) => jstDateFormatter.format(new Date(value));

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const legacyCountForBucket = (
  period: AccessPeriod,
  bucketStart: string,
  dailyRows: Array<{ access_date: string; view_count: number }>
) => {
  if (period === "hour") return 0;

  const start = new Date(bucketStart);
  const startKey = toJstDateKey(start);

  if (period === "day") {
    return dailyRows
      .filter(row => row.access_date === startKey)
      .reduce((sum, row) => sum + row.view_count, 0);
  }

  if (period === "month") {
    const monthKey = startKey.slice(0, 7);
    return dailyRows
      .filter(row => row.access_date.startsWith(monthKey))
      .reduce((sum, row) => sum + row.view_count, 0);
  }

  const end = addDays(start, 7);
  const endKey = toJstDateKey(end);
  return dailyRows
    .filter(row => row.access_date >= startKey && row.access_date < endKey)
    .reduce((sum, row) => sum + row.view_count, 0);
};

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

    const rows = (data ?? []) as Array<{
      period: AccessPeriod;
      bucket_start: string;
      bucket_label: string;
      visitor_count: number;
      is_future: boolean;
    }>;

    const { data: legacyRows } = await supabase
      .from("site_access_daily")
      .select("access_date, view_count");

    const normalizedLegacyRows = ((legacyRows ?? []) as Array<{ access_date: string; view_count: number }>).map(row => ({
      access_date: row.access_date,
      view_count: Number(row.view_count ?? 0),
    }));

    const mergedRows = rows.map(row => {
      const visitorCount = Number(row.visitor_count ?? 0);
      const legacyCount = legacyCountForBucket(period as AccessPeriod, row.bucket_start, normalizedLegacyRows);
      const isLegacy = visitorCount === 0 && legacyCount > 0 && !row.is_future;

      return {
        ...row,
        visitor_count: visitorCount,
        legacy_count: legacyCount,
        is_legacy: isLegacy,
      };
    });

    return NextResponse.json({ rows: mergedRows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "アクセス集計を取得できませんでした" }, { status: 500 });
  }
}
