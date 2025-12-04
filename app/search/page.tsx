"use client";

import Link from "next/link";
import { ArrowLeft, Search, History, X } from "lucide-react";
import { useState, useEffect } from "react";
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

export default function SearchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadSearchHistory();
    }
  }, [user]);

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
      if (data) setSearchHistory(data);
    } catch (err) {
      console.error("Error loading search history:", err);
    }
  };

  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) return;

    setLoading(true);
    setSearchQuery(keyword);

    try {
      // Search items
      const { data, error } = await supabase
        .from("items")
        .select("id, title, selling_price, condition")
        .ilike("title", `%${keyword}%`)
        .eq("status", "available")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setSearchResults(data);

      // Save search history if user is logged in
      if (user) {
        await supabase.from("search_histories").insert({
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

        {/* Search Bar */}
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="教科書名を入力..."
              className="w-full py-3 pl-12 pr-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </form>
      </header>

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
