"use client";

import Link from "next/link";
import { Search, Heart, BookOpen, TrendingUp, User } from "lucide-react";
import { useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";

type Item = {
  id: string;
  title: string;
  selling_price: number;
  condition: string;
};

const conditionColors: Record<string, string> = {
  "美品": "bg-green-100 text-green-700",
  "良好": "bg-blue-100 text-blue-700",
  "可": "bg-yellow-100 text-yellow-700",
};

export default function HomeClient({ items }: { items: Item[] }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-primary">
            TextNext
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-primary">
              <BookOpen className="w-5 h-5" />
              <span className="text-sm font-medium">学内教科書フリマ</span>
            </div>
            {user ? (
              <Link href="/profile">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <User className="w-5 h-5 text-primary" />
                </div>
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <Link href="/search" className="block">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <input
              type="text"
              placeholder="教科書を検索..."
              className="w-full py-3 pl-12 pr-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none hover:border-primary/50 hover:bg-white transition-all cursor-pointer"
              readOnly
            />
          </div>
        </Link>
      </header>

      {/* Content */}
      <div className="px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">
            おすすめの教材
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">まだ出品がありません</p>
            {user && (
              <Link
                href="/listing"
                className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all"
              >
                最初の出品者になる
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Link key={item.id} href={`/product/${item.id}`}>
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-md hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${conditionColors[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                          {item.condition}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {item.title}
                      </h3>
                      <p className="text-2xl font-bold text-primary">
                        ¥{item.selling_price.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90"
                      aria-label={favorites.includes(item.id) ? "お気に入りから削除" : "お気に入りに追加"}
                    >
                      <Heart
                        className={`w-6 h-6 transition-all duration-200 ${favorites.includes(item.id)
                          ? "fill-red-500 text-red-500 scale-110"
                          : "text-gray-300 hover:text-red-300"
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
