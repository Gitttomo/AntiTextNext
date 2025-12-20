import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import SearchClient, { Item } from "./client";

// Initialize Supabase client for Server Component
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ひらがな→カタカナ変換
const hiraganaToKatakana = (str: string): string => {
  return str.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  );
};

// カタカナ→ひらがな変換
const katakanaToHiragana = (str: string): string => {
  return str.replace(/[\u30A1-\u30F6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
};

const searchItems = async (query: string, hiragana: string, katakana: string) => {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("items")
    .select("id, title, selling_price, condition, favorites(count), locked_until")
    .eq("status", "available")
    .or(`locked_until.is.null,locked_until.lt.${now}`)
    .or(`title.ilike.%${query}%,title.ilike.%${hiragana}%,title.ilike.%${katakana}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).map((item: any) => ({
    ...item,
    favorite_count: item.favorites?.[0]?.count || 0,
    favorites: undefined
  })) as Item[];
};

// 動的レンダリング
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  let initialResults: Item[] = [];

  if (query) {
    const hiragana = katakanaToHiragana(query);
    const katakana = hiraganaToKatakana(query);

    try {
      initialResults = await searchItems(query, hiragana, katakana);
    } catch (err) {
      // エラー時は空結果
    }
  }

  return <SearchClient initialResults={initialResults} initialQuery={query} />;
}
