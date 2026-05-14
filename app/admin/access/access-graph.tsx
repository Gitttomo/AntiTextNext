"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

type AccessPeriod = "month" | "week" | "day" | "hour";

export type AccessBucket = {
  period: AccessPeriod;
  bucket_start: string;
  bucket_label: string;
  visitor_count: number;
  is_future: boolean;
};

type DrillState = {
  period: AccessPeriod;
  center: string | null;
  title: string;
};

const periodMeta: Record<AccessPeriod, { label: string; next?: AccessPeriod; unit: string }> = {
  month: { label: "月ごと", next: "week", unit: "年" },
  week: { label: "週ごと", next: "day", unit: "8週" },
  day: { label: "日ごと", next: "hour", unit: "7日" },
  hour: { label: "時間ごと", unit: "8時間" },
};

const shiftAmount: Record<AccessPeriod, { value: number; unit: "FullYear" | "Date" | "Hours" }> = {
  month: { value: 1, unit: "FullYear" },
  week: { value: 56, unit: "Date" },
  day: { value: 7, unit: "Date" },
  hour: { value: 8, unit: "Hours" },
};

const toJstDate = (value: string | null) => {
  if (value) return new Date(value);
  return new Date();
};

const shiftCenter = (period: AccessPeriod, center: string | null, direction: -1 | 1) => {
  const date = toJstDate(center);
  const shift = shiftAmount[period];

  if (shift.unit === "FullYear") {
    date.setFullYear(date.getFullYear() + shift.value * direction);
  } else if (shift.unit === "Date") {
    date.setDate(date.getDate() + shift.value * direction);
  } else {
    date.setHours(date.getHours() + shift.value * direction);
  }

  return date.toISOString();
};

const formatYear = (value?: string) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date(value));
};

const formatMonthNumber = (value: string) => (
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric" })
    .format(new Date(value))
    .replace("月", "")
);

const formatTitleDate = (period: AccessPeriod, value: string | null) => {
  const date = toJstDate(value);
  if (period === "month") {
    return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric" }).format(date);
  }
  if (period === "hour") {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(date);
};

export function AccessGraph({ initialRows }: { initialRows: AccessBucket[] }) {
  const [rows, setRows] = useState(initialRows);
  const [history, setHistory] = useState<DrillState[]>([]);
  const [state, setState] = useState<DrillState>({
    period: "month",
    center: initialRows[0]?.bucket_start ?? null,
    title: "月ごと",
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const maxActual = useMemo(
    () => Math.max(...rows.filter(row => !row.is_future).map(row => row.visitor_count), 1),
    [rows]
  );
  const total = rows.reduce((sum, row) => sum + (row.is_future ? 0 : row.visitor_count), 0);
  const leftYear = formatYear(rows[0]?.bucket_start);
  const rightYear = formatYear(rows[rows.length - 1]?.bucket_start);

  const loadRows = (nextState: DrillState, nextHistory = history) => {
    startTransition(async () => {
      setError("");
      const params = new URLSearchParams({ period: nextState.period });
      if (nextState.center) params.set("center", nextState.center);

      const response = await fetch(`/api/admin/access?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "アクセス集計を取得できませんでした");
        return;
      }

      setRows((payload.rows ?? []).map((row: AccessBucket) => ({
        ...row,
        visitor_count: Number(row.visitor_count ?? 0),
        is_future: Boolean(row.is_future),
      })));
      setState(nextState);
      setHistory(nextHistory);
    });
  };

  const drillDown = (row: AccessBucket) => {
    const next = periodMeta[state.period].next;
    if (!next) return;
    loadRows(
      {
        period: next,
        center: row.bucket_start,
        title: `${periodMeta[next].label}: ${rowLabel(row)}`,
      },
      [...history, state]
    );
  };

  const goBack = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    loadRows(previous, history.slice(0, -1));
  };

  const move = (direction: -1 | 1) => {
    const nextCenter = shiftCenter(state.period, state.center, direction);
    loadRows({
      ...state,
      center: nextCenter,
      title: `${periodMeta[state.period].label}: ${formatTitleDate(state.period, nextCenter)}`,
    });
  };

  const rowLabel = (row: AccessBucket) => {
    if (row.period === "month") return formatMonthNumber(row.bucket_start);
    return row.bucket_label;
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">{state.title}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            棒をクリックすると一段細かい単位に切り替わります。点線はまだ集まりきっていない未来の枠です。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              拡大
            </button>
          )}
          <button
            type="button"
            onClick={() => move(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label={`前の${periodMeta[state.period].unit}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label={`次の${periodMeta[state.period].unit}`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          {error}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <div className="text-xs font-black text-slate-500">{leftYear}</div>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-500">表示範囲の実測合計</p>
          <p className="text-lg font-black text-slate-900">{total.toLocaleString()}人</p>
        </div>
        <div className="text-xs font-black text-slate-500">{rightYear}</div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-slate-100 bg-slate-50/60 px-3 pb-3 pt-4">
        <div
          className="grid h-72 min-w-[760px] items-end gap-3 border-b border-l border-slate-200 px-2 pb-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(rows.length, 1)}, minmax(4.5rem, 1fr))` }}
        >
            {rows.map(row => {
              const visualCount = row.is_future ? maxActual / 2 : row.visitor_count;
              const height = Math.max((visualCount / maxActual) * 100, !row.is_future && row.visitor_count > 0 ? 8 : 0);
              const canDrill = Boolean(periodMeta[state.period].next);

              return (
                <button
                  key={`${row.period}-${row.bucket_start}`}
                  type="button"
                  onClick={() => drillDown(row)}
                  disabled={!canDrill || isPending}
                  className="flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 py-1 text-center transition hover:bg-white/80 disabled:cursor-default disabled:hover:bg-transparent"
                  title={`${rowLabel(row)}: ${row.is_future ? "未確定" : `${row.visitor_count}人`}`}
                >
                  <div className="flex h-56 w-full items-end justify-center">
                    <div
                      className={
                        row.is_future
                          ? "w-full max-w-12 rounded-t-md border-2 border-dashed border-sky-400 bg-transparent"
                          : "w-full max-w-12 rounded-t-md bg-sky-500 shadow-sm"
                      }
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="w-full truncate text-[11px] font-black text-slate-600">{rowLabel(row)}</span>
                </button>
              );
            })}
        </div>
      </div>

      {isPending && <p className="mt-3 text-xs font-bold text-slate-500">読み込み中...</p>}
    </section>
  );
}
