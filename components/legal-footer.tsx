"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PRIVACY_POLICY_TEXT, TERMS_TEXT } from "@/lib/legal";

type LegalKind = "terms" | "privacy";

export default function LegalFooter() {
  const [active, setActive] = useState<LegalKind | null>(null);

  const title = active === "terms" ? "利用規約" : "プライバシーポリシー";
  const text = active === "terms" ? TERMS_TEXT : PRIVACY_POLICY_TEXT;

  return (
    <>
      <footer className="border-t border-gray-100 bg-white px-6 py-6 pb-28 text-center text-xs text-gray-500">
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setActive("terms")}
            className="font-semibold text-gray-600 hover:text-primary"
          >
            利用規約
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setActive("privacy")}
            className="font-semibold text-gray-600 hover:text-primary"
          >
            プライバシーポリシー
          </button>
        </div>
      </footer>

      {active && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center">
          <button
            type="button"
            aria-label="閉じる"
            className="absolute inset-0 bg-black/40"
            onClick={() => setActive(null)}
          />
          <section className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="閉じる"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{text}</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
