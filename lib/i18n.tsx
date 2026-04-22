"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import ja from "@/locales/ja.json";
import en from "@/locales/en.json";

export type Locale = "ja" | "en";

const dictionaries: Record<Locale, typeof ja> = { ja, en };

type TranslationDict = typeof ja;

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType>({
  locale: "ja",
  setLocale: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");
  const [mounted, setMounted] = useState(false);

  // 初回: ブラウザ言語を検出 or 保存済み設定を読み込み
  useEffect(() => {
    const saved = localStorage.getItem("textnext_locale") as Locale | null;
    if (saved && (saved === "ja" || saved === "en")) {
      setLocaleState(saved);
    } else {
      // ブラウザの言語設定を検出
      const browserLang = navigator.language || (navigator as any).userLanguage || "ja";
      const detectedLocale: Locale = browserLang.startsWith("en") ? "en" : "ja";
      setLocaleState(detectedLocale);
      localStorage.setItem("textnext_locale", detectedLocale);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("textnext_locale", newLocale);
  }, []);

  // ドット記法でネストされた翻訳を取得: t("nav.home") → "ホーム"
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split(".");
    let value: any = dictionaries[locale];
    
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // フォールバック: キーをそのまま返す
      }
    }

    if (typeof value !== "string") return key;

    // パラメータ置換: {n} → 実際の値
    if (params) {
      let result = value;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(paramValue));
      }
      return result;
    }

    return value;
  }, [locale]);

  // SSR/hydration mismatch防止: マウント前はjaをデフォルト表示
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: "ja", setLocale, t: (key) => {
        const keys = key.split(".");
        let value: any = ja;
        for (const k of keys) {
          if (value && typeof value === "object" && k in value) value = value[k];
          else return key;
        }
        return typeof value === "string" ? value : key;
      }}}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export { dictionaries };
