"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

const STORAGE_KEY = "textnext-trial-notice-collapsed";

export default function TrialNoticeBanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    setReady(true);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  if (!ready) return null;

  return (
    <div className="sticky top-0 z-[70] border-b border-amber-200 bg-amber-50/95 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-lg items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black text-amber-900">試験運用中のお知らせ</p>
            <button
              type="button"
              onClick={toggle}
              className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-amber-700 hover:bg-amber-100"
              aria-expanded={!collapsed}
            >
              {collapsed ? "開く" : "閉じる"}
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          </div>
          {!collapsed && (
            <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800">
              TextNext は現在サイト作成中のため、試験運用として公開しています。表示や動作に不具合がある場合があります。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
