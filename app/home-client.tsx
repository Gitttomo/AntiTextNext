"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Heart, BookOpen, TrendingUp, User, Users, ChevronDown } from "lucide-react";
import { useState, useCallback, memo, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

type Item = {
  id: string;
  title: string;
  selling_price: number;
  condition: string;
  front_image_url?: string;
};

const conditionColors: Record<string, string> = {
  "美品": "bg-green-100 text-green-700",
  "良好": "bg-blue-100 text-blue-700",
  "可": "bg-yellow-100 text-yellow-700",
};

// アイテムカードをメモ化して再レンダリングを防止
const ItemCard = memo(function ItemCard({
  item,
  isFavorite,
  onToggleFavorite,
  index,
}: {
  item: Item;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  index: number;
}) {
  return (
    <Link href={`/product/${item.id}`}>
      <div 
        className="bg-white rounded-2xl border border-gray-200 p-4 shadow-md hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300 animate-slide-in-up"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <div className="flex items-start gap-4">
          {/* サムネイル画像 */}
          <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
            {item.front_image_url ? (
              <Image
                src={item.front_image_url}
                alt={item.title}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <BookOpen className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* コンテンツ */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${conditionColors[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                {item.condition}
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
              {item.title}
            </h3>
            <p className="text-xl font-bold text-primary">
              ¥{item.selling_price.toLocaleString()}
            </p>
          </div>

          {/* ハートボタン */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-all active:scale-90 flex-shrink-0 heart-container"
            aria-label={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
          >
            <div className={`heart-lines ${isFavorite ? 'active' : ''}`} />
            <Heart
              className={`w-5 h-5 transition-all duration-200 relative ${isFavorite
                ? "fill-red-500 text-red-500 scale-110 heart-burst"
                : "text-gray-300 hover:text-red-300"
              }`}
            />
          </button>
        </div>
      </div>
    </Link>
  );
});

type HomeClientProps = {
  items: Item[];
  popularItems: Item[];
  totalPopularCount: number;
};

export default function HomeClient({ items, popularItems: initialPopularItems, totalPopularCount }: HomeClientProps) {
  const { user, loading, avatarUrl } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // みんなの出品の状態管理
  const [popularItems, setPopularItems] = useState<Item[]>(initialPopularItems);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPopularItems.length < totalPopularCount);

  // お気に入りセットをメモ化
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
  }, []);

  const loadMorePopular = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const currentLength = popularItems.length;
      const { data, error } = await supabase
        .from("items")
        .select("id, title, selling_price, condition, front_image_url")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .range(currentLength, currentLength + 14);

      if (!error && data) {
        const newItems = data as Item[];
        setPopularItems(prev => [...prev, ...newItems]);
        if (currentLength + newItems.length >= totalPopularCount || newItems.length < 15) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading more items:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in-up {
          animation: slideInUp 0.4s ease-out forwards;
          opacity: 0;
        }
      `}</style>

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
            {loading ? (
              <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
            ) : user ? (
              <Link href="/profile">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-colors">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="プロフィール"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
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

      {/* おすすめの教材 */}
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
            {items.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                isFavorite={favoriteSet.has(item.id)}
                onToggleFavorite={toggleFavorite}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* みんなの出品 */}
      {popularItems.length > 0 && (
        <div className="px-6 py-8 bg-gray-50">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              みんなの出品
            </h2>
          </div>

          <div className="space-y-4">
            {popularItems.map((item, index) => (
              <ItemCard
                key={`popular-${item.id}`}
                item={item}
                isFavorite={favoriteSet.has(item.id)}
                onToggleFavorite={toggleFavorite}
                index={index}
              />
            ))}
          </div>

          {/* もっと見る / 出品物は以上です */}
          <div className="mt-8 text-center">
            {hasMore ? (
              <button
                onClick={loadMorePopular}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-primary/50 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    もっと見る
                  </>
                )}
              </button>
            ) : (
              <p className="text-gray-500 py-4">
                出品物は以上です...!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
