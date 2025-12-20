/**
 * 教科書検索ページ
 * 
 * 教科書を検索するためのページです。
 * 
 * 機能:
 * - リアルタイムサジェスト表示
 * - ひらがな/カタカナの相互変換対応検索
 * - 検索履歴の保存・表示
 * - 検索結果の一覧表示
 * 
 * ログインユーザーは検索履歴が自動保存されます。
 */

"use client";

import Link from "next/link";
import { ArrowLeft, Search, History } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

type SearchHistory = {
  id: string;
  keyword: string;
  searched_at: string;
};

type Item = {
  id: string;
  title: string;
  selling_price: number;
  condition: string;
};

type Suggestion = {
  id: string;
  title: string;
};

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

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (user) {
      loadSearchHistory();
    }
  }, [user]);

  // 入力時にサジェストを取得
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.length < 1) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      try {
        const query = searchQuery.trim();
        const hiragana = katakanaToHiragana(query);
        const katakana = hiraganaToKatakana(query);

        // 複数パターンで検索（元の入力、ひらがな変換、カタカナ変換）
        const { data, error } = await supabase
          .from("items")
          .select("id, title")
          .eq("status", "available")
          .or(`title.ilike.%${query}%,title.ilike.%${hiragana}%,title.ilike.%${katakana}%`)
          .limit(8);

        if (error) throw error;

        // 重複を除去
        const uniqueTitles = new Map<string, Suggestion>();
        (data || []).forEach((item: any) => {
          if (!uniqueTitles.has(item.title)) {
            uniqueTitles.set(item.title, { id: item.id, title: item.title });
          }
        });

        setSuggestions(Array.from(uniqueTitles.values()));
        setShowSuggestions(true);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const loadSearchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("search_histories")
        .select("*")
        .eq("user_id", user.id)
        .order("searched_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (data) setSearchHistory(data as SearchHistory[]);
    } catch (err) {
      console.error("Error loading search history:", err);
    }
  };

  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) return;

    setLoading(true);
    setSearchQuery(keyword);
    setShowSuggestions(false);

    try {
      const query = keyword.trim();
      const hiragana = katakanaToHiragana(query);
      const katakana = hiraganaToKatakana(query);

      // 複数パターンで検索
      const { data, error } = await supabase
        .from("items")
        .select("id, title, selling_price, condition")
        .eq("status", "available")
        .or(`title.ilike.%${query}%,title.ilike.%${hiragana}%,title.ilike.%${katakana}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setSearchResults(data as Item[]);

      // Save search history if user is logged in
      if (user) {
        await (supabase.from("search_histories") as any).insert({
          user_id: user.id,
          keyword: keyword,
        });
        loadSearchHistory();
      }
    } catch (err) {
      console.error("Error searching:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setSearchQuery(suggestion.title);
    handleSearch(suggestion.title);
  };

  const handleHistoryClick = (keyword: string) => {
    handleSearch(keyword);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 border-b sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <h1 className="text-3xl font-bold text-primary">
            検索
          </h1>
        </div>

        {/* Search Bar with Suggestions */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
              placeholder="教科書名を入力...（ひらがな・カタカナ対応）"
              className="w-full py-3 pl-12 pr-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b last:border-b-0"
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-900 truncate">{suggestion.title}</span>
                </button>
              ))}
            </div>
          )}
        </form>
      </header>

      {/* Click outside to close suggestions */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowSuggestions(false)}
        />
      )}

      {/* Search History */}
      {user && searchHistory.length > 0 && !searchQuery && (
        <div className="px-6 py-6 border-b">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-700">検索履歴</h2>
          </div>
          <div className="space-y-2">
            {searchHistory.map((history) => (
              <button
                key={history.id}
                onClick={() => handleHistoryClick(history.keyword)}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{history.keyword}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">検索中...</p>
          </div>
        ) : searchResults.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {searchResults.length}件の結果
            </h3>
            <div className="space-y-4">
              {searchResults.map((item) => (
                <Link key={item.id} href={`/product/${item.id}`}>
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-md hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {item.condition}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-xl font-bold text-primary">
                          ¥{item.selling_price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : searchQuery ? (
          <div className="text-center py-12">
            <p className="text-gray-500">結果が見つかりませんでした</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
