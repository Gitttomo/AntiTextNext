"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Heart, BookOpen, TrendingUp, User, Users, ChevronDown } from "lucide-react";
import { useState, useCallback, memo, useMemo, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

type Item = {
  id: string;
  title: string;
  selling_price: number;
  condition: string;
  front_image_url: string | null;
  favorite_count?: number;
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

          {/* ハートボタン & カウント */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(item.id);
              }}
              className="group/heart relative p-2 -m-2 hover:bg-red-50 rounded-full transition-all active:scale-90 flex items-center justify-center heart-container"
              aria-label={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
            >
              {/* Expanding Ring */}
              <div className={`heart-ring ${isFavorite ? 'active' : ''}`} />
              
              {/* Particles */}
              <div className={`heart-particle-container ${isFavorite ? 'active' : ''}`}>
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="heart-dot" />
                ))}
              </div>

              <Heart
                className={`w-5 h-5 transition-all duration-300 relative heart-main ${isFavorite
                  ? "fill-red-500 text-red-500 heart-pop"
                  : "text-gray-300 group-hover/heart:text-red-300"
                }`}
              />
            </button>
            {item.favorite_count !== undefined && item.favorite_count > 0 && (
              <span className={`text-xs font-bold transition-colors duration-300 ${isFavorite ? 'text-red-500' : 'text-gray-400'}`}>
                {item.favorite_count}
              </span>
            )}
          </div>
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

export default function HomeClient({ items: initialRecommendedItems, popularItems: initialPopularItems, totalPopularCount }: HomeClientProps) {
  const { user, loading, avatarUrl } = useAuth();
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // 各アイテムの状態管理（サーバーのキャッシュを上書きできるようにState化）
  const [recommendedItems, setRecommendedItems] = useState<Item[]>(initialRecommendedItems);
  const [popularItems, setPopularItems] = useState<Item[]>(initialPopularItems);
  
  const [loadingMoreRecommended, setLoadingMoreRecommended] = useState(false);
  const [hasMoreRecommended, setHasMoreRecommended] = useState(false); // 初期はサーバーサイドの10件
  const [totalRecommendedCount, setTotalRecommendedCount] = useState(10);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPopularItems.length < totalPopularCount);

  // お気に入りセットをメモ化
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  // 初期表示時にお気に入り & パーソナライズされたおすすめをロード
  useEffect(() => {
    const fetchData = async () => {
      // 1. お気に入り状態のロード & 最新カウントの取得
      const itemIds = [
        ...recommendedItems.map(i => i.id),
        ...popularItems.map(i => i.id)
      ];
      
      const promises: any[] = [];
      
      if (itemIds.length > 0) {
        promises.push(
          supabase
            .from("items")
            .select("id, favorites(count)")
            .in("id", itemIds)
        );
      }

      if (user) {
        promises.push(
          supabase
            .from("favorites")
            .select("item_id")
            .eq("user_id", user.id)
        );
        // ユーザーの所属情報を取得
        promises.push(
          supabase
            .from("profiles")
            .select("department, major")
            .eq("user_id", user.id)
            .single()
        );
      }

      const results = await Promise.all(promises);
      let countRes = itemIds.length > 0 ? results[0] : null;
      let favRes = user ? results[1] : null;
      let profileRes = user ? results[2] : null;

      // カウントの反映
      if (countRes?.data) {
        const countMap = new Map((countRes.data as any[]).map((i: any) => [i.id, i.favorites?.[0]?.count || 0]));
        const updateItemCounts = (prev: Item[]) => prev.map(item => ({
          ...item,
          favorite_count: countMap.get(item.id) ?? item.favorite_count
        }));
        setRecommendedItems(prev => updateItemCounts(prev));
        setPopularItems(prev => updateItemCounts(prev));
      }

      // お気に入り状態の反映
      if (user && favRes?.data && Array.isArray(favRes.data)) {
        setFavorites(favRes.data.map((f: any) => f.item_id));
      } else if (!user) {
        setFavorites([]);
        // ログアウト時は初期のおすすめ(最新10件)に戻す
        setRecommendedItems(initialRecommendedItems);
        setHasMoreRecommended(false);
      }

      // 2. パーソナライズされたおすすめの取得
      if (user && profileRes?.data) {
        const { department, major } = profileRes.data as any;
        
        let query = supabase
          .from("items")
          .select("id, title, selling_price, condition, front_image_url, favorites(count), profiles!inner(department, major)", { count: 'exact' })
          .eq("status", "available")
          .eq("profiles.department", department);
        
        if (major) {
          query = query.eq("profiles.major", major);
        }
        
        const { data: majorData, count, error } = await query
          .order("created_at", { ascending: false })
          .limit(15);

        if (!error && majorData) {
          const personalized = (majorData as any[]).map(item => ({
            ...item,
            favorite_count: item.favorites?.[0]?.count || 0
          })) as Item[];
          
          setRecommendedItems(personalized);
          setTotalRecommendedCount(count || 0);
          setHasMoreRecommended((count || 0) > personalized.length);
        }
      }
    };

    fetchData();
  }, [user]); // userが変わった時（ログイン/ログアウト）に再実行

  const toggleFavorite = useCallback(async (id: string) => {
    if (!user) return;

    const isFav = favoriteSet.has(id);
    
    // 状態が既に遷移中（連打防止）などのためのガードは特になし（Setなので重複はしない）
    
    // 楽観的UI更新
    setFavorites(prev => 
      isFav ? prev.filter(favId => favId !== id) : [...prev, id]
    );

    // カウントの見た目上の調整
    const updateCount = (prev: Item[]) => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          favorite_count: Math.max(0, (item.favorite_count || 0) + (isFav ? -1 : 1))
        };
      }
      return item;
    });

    setRecommendedItems(prev => updateCount(prev));
    setPopularItems(prev => updateCount(prev));

    // バックエンド同期
    try {
      if (isFav) {
        await (supabase
          .from("favorites") as any)
          .delete()
          .match({ user_id: user.id, item_id: id });
      } else {
        // 重複挿入エラーを避けるために一応チェック（DBにはUNIQUE制約がある）
        await (supabase
          .from("favorites") as any)
          .upsert({ user_id: user.id, item_id: id }, { onConflict: 'user_id,item_id' });
      }
    } catch (err) {
      console.error("Favorite sync failed:", err);
      // 失敗時はロールバックするのが丁寧
      setFavorites(prev => 
        isFav ? [...prev, id] : prev.filter(favId => favId !== id)
      );
    }
  }, [user, favoriteSet]);

  const loadMoreRecommended = async () => {
    if (loadingMoreRecommended || !hasMoreRecommended || !user) return;

    setLoadingMoreRecommended(true);
    try {
      const currentLength = recommendedItems.length;
      
      // ユーザーの所属情報を再取得（またはStateから持ってくる）
      const { data: profile } = await supabase
        .from("profiles")
        .select("department, major")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        let query = supabase
          .from("items")
          .select("id, title, selling_price, condition, front_image_url, favorites(count), profiles!inner(department, major)")
          .eq("status", "available")
          .eq("profiles.department", (profile as any).department);
        
        if ((profile as any).major) {
          query = query.eq("profiles.major", (profile as any).major);
        }

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .range(currentLength, currentLength + 14);

        if (!error && data) {
          const newItems = (data as any[]).map(item => ({
            ...item,
            favorite_count: item.favorites?.[0]?.count || 0
          })) as Item[];
          setRecommendedItems(prev => [...prev, ...newItems]);
          if (currentLength + newItems.length >= totalRecommendedCount) {
            setHasMoreRecommended(false);
          }
        }
      }
    } catch (err) {
      console.error("Error loading more recommended items:", err);
    } finally {
      setLoadingMoreRecommended(false);
    }
  };

  const loadMorePopular = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const currentLength = popularItems.length;
      const { data, error } = await supabase
        .from("items")
        .select("id, title, selling_price, condition, front_image_url, favorites(count)")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .range(currentLength, currentLength + 14);

      if (!error && data) {
        const newItems = (data as any[]).map(item => ({
          ...item,
          favorite_count: item.favorites?.[0]?.count || 0
        })) as Item[];
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
        <div className="flex items-end justify-between mb-6">
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-primary leading-none tracking-tight">
              TextNext
            </h1>
            <div className="flex items-center gap-1 text-primary/80 mt-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold tracking-tight">東工大生のための教科書フリマ</span>
            </div>
          </div>
          <div className="flex-shrink-0">
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
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 whitespace-nowrap block"
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

        {recommendedItems.length === 0 ? (
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
          <>
            <div className="space-y-4">
              {recommendedItems.map((item, index) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isFavorite={favoriteSet.has(item.id)}
                  onToggleFavorite={toggleFavorite}
                  index={index}
                />
              ))}
            </div>
            
            {hasMoreRecommended && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMoreRecommended}
                  disabled={loadingMoreRecommended}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-primary/50 transition-all disabled:opacity-50"
                >
                  {loadingMoreRecommended ? (
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
              </div>
            )}
          </>
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
