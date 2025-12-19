
import { createClient } from "@supabase/supabase-js";
import SearchClient, { Item } from "./client";

// Initialize Supabase client for Server Component (Public access is fine for search)
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

export const revalidate = 0; // Search results should be fresh

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
      const { data, error } = await supabase
        .from("items")
        .select("id, title, selling_price, condition")
        .eq("status", "available")
        .or(`title.ilike.%${query}%,title.ilike.%${hiragana}%,title.ilike.%${katakana}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        initialResults = data as Item[];
      }
    } catch (err) {
      console.error("Error searching items:", err);
    }
  }

  return <SearchClient initialResults={initialResults} initialQuery={query} />;
}
