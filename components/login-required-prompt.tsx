"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useLoginRequiredPrompt(timeoutMs = 1100) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { visible, show };
}

export function LoginRequiredBubble({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-full right-0 z-20 mb-2 whitespace-nowrap rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white shadow-lg ${
        visible ? "block" : "hidden"
      }`}
      role="status"
      aria-live="polite"
    >
      ログインしてください
      <span className="absolute right-4 top-full h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900" />
    </div>
  );
}
