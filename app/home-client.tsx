"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Heart, BookOpen, TrendingUp, User, Users, ChevronDown, RefreshCw } from "lucide-react";
import { useState, useCallback, memo, useMemo, useEffect, useRef, TouchEvent as ReactTouchEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { getItemImageUrl } from "@/lib/image-storage";

type Item = {
  id: string;
  title: string;
  selling_price: number;
  //condition: string;
  front_image_url: string | null;
  front_thumbnail_url?: string | null;
  favorite_count?: number;
  seller_id?: string;
};

/* const conditionColors: Record<string, string> = {
  "美品": "bg-green-100 text-green-700",
  "良好": "bg-blue-100 text-blue-700",
  "可": "bg-yellow-100 text-yellow-700",
}; */

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
            {getItemImageUrl(item, "front", "thumbnail") ? (
              <Image
                src={getItemImageUrl(item, "front", "thumbnail")!}
                alt={item.title}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                loading="lazy"
                quality={55}
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
              {/* <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${conditionColors[item.condition] || 'bg-gray-100 text-gray-700'}`}>
                {item.condition}
              </span> */}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
              {item.title}
            </h3>
            <p className="text-xl font-bold gradient-text-price">
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
  const { user, avatarUrl, loading } = useAuth();
  const { t } = useI18n();
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // 各アイテムの状態管理（サーバーのキャッシュを上書きできるようにState化）
  const [recommendedItems, setRecommendedItems] = useState<Item[]>(initialRecommendedItems);
  const [popularItems, setPopularItems] = useState<Item[]>(initialPopularItems);
  
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [loadingMoreRecommended, setLoadingMoreRecommended] = useState(false);
  const [hasMoreRecommended, setHasMoreRecommended] = useState(false); // 初期はサーバーサイドの10件
  const [totalRecommendedCount, setTotalRecommendedCount] = useState(initialRecommendedItems.length);

  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPopularItems.length < totalPopularCount);
  const requestIdRef = useRef(0);

  // Pull-to-Refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const PULL_THRESHOLD = 80;

  // お気に入りセットをメモ化
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const recommendedIdSet = useMemo(() => new Set(recommendedItems.map(item => item.id)), [recommendedItems]);
  const displayedPopularItems = useMemo(
    () => popularItems.filter(item => !recommendedIdSet.has(item.id) && (!user || item.seller_id !== user.id)),
    [popularItems, recommendedIdSet, user]
  );

  // 初期表示時にお気に入り & パーソナライズされたおすすめをロード
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const fetchData = async () => {
      if (!user) {
        setFavorites([]);
        setRecommendedItems([]);
        setHasMoreRecommended(false);
        setTotalRecommendedCount(0);
        setLoadingRecommended(false);
      }

      // 1. お気に入り状態のロード & 最新カウントの取得
      const itemIds = [
        ...recommendedItems.map(i => i.id),
        ...popularItems.map(i => i.id)
      ];
      
      const promises: any[] = [];
      
      if (itemIds.length > 0) {
        // アイテムの存在確認とカウント取得を同時に行う
        // 削除されたアイテムはここで除外される
        promises.push(
          supabase
            .from("items")
            .select("id, favorites(count)")
            .in("id", itemIds)
            .eq("status", "available") // 削除されたアイテムや非公開アイテムを除外
        );
      }

      if (user) {
        setLoadingRecommended(true);
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
      if (cancelled || requestId !== requestIdRef.current) return;

      let countRes = itemIds.length > 0 ? results[0] : null;
      let favRes = user ? results[1] : null;
      let profileRes = user ? results[2] : null;

      // カウントの反映 & 削除されたアイテムのフィルタリング
      if (countRes?.data) {
        const validItemIds = new Set((countRes.data as any[]).map((i: any) => i.id));
        const countMap = new Map((countRes.data as any[]).map((i: any) => [i.id, i.favorites?.[0]?.count || 0]));
        
        const updateItemCounts = (prev: Item[]) => prev
          .filter(item => validItemIds.has(item.id)) // 削除されたアイテムを除外
          .map(item => ({
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
        setRecommendedItems([]);
        setHasMoreRecommended(false);
        setTotalRecommendedCount(0);
        setLoadingRecommended(false);
      }

      // 2. パーソナライズされたおすすめの取得
      if (user && profileRes?.data) {
        const { department, major } = profileRes.data as any;
        
        let query = supabase
          .from("items")
          .select("id, title, selling_price, front_image_url, front_thumbnail_url, favorites(count), profiles!inner(department, major)", { count: 'exact' })
          .eq("status", "available")
          .neq("seller_id", user.id)
          .eq("profiles.department", department);
        
        if (major) {
          query = query.eq("profiles.major", major);
        }
        
        const { data: majorData, count, error } = await query
          .order("created_at", { ascending: false })
          .limit(15);

        if (!error && majorData) {
          if (cancelled || requestId !== requestIdRef.current) return;

          const personalized = (majorData as any[]).map(item => ({
            ...item,
            favorite_count: item.favorites?.[0]?.count || 0
          })) as Item[];
          
          setRecommendedItems(personalized);
          setTotalRecommendedCount(count || 0);
          setHasMoreRecommended((count || 0) > personalized.length);
        }
      }

      if (user) {
        setLoadingRecommended(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user, initialRecommendedItems]); // userが変わった時（ログイン/ログアウト）に再実行

  const favoriteStateRef = useRef<Set<string>>(new Set(favorites));
  const favoriteSyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    favoriteStateRef.current = new Set(favorites);
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    if (!user) return;

    const wasFavorite = favoriteStateRef.current.has(id);
    const shouldFavorite = !wasFavorite;

    if (shouldFavorite) {
      favoriteStateRef.current.add(id);
    } else {
      favoriteStateRef.current.delete(id);
    }

    // 楽観的UI更新
    setFavorites(prev => 
      shouldFavorite
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter(favId => favId !== id)
    );

    // カウントの見た目上の調整
    const delta = shouldFavorite ? 1 : -1;
    const updateCount = (prev: Item[]) => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          favorite_count: Math.max(0, (item.favorite_count || 0) + delta)
        };
      }
      return item;
    });

    setRecommendedItems(prev => updateCount(prev));
    setPopularItems(prev => updateCount(prev));

    const existingTimer = favoriteSyncTimersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        if (shouldFavorite) {
          await (supabase
            .from("favorites") as any)
            .upsert({ user_id: user.id, item_id: id }, { onConflict: 'user_id,item_id' });
        } else {
          await (supabase
            .from("favorites") as any)
            .delete()
            .match({ user_id: user.id, item_id: id });
        }
      } catch (err) {
        console.error("Favorite sync failed:", err);
        if (favoriteStateRef.current.has(id) === shouldFavorite) {
          if (wasFavorite) {
            favoriteStateRef.current.add(id);
          } else {
            favoriteStateRef.current.delete(id);
          }
          setFavorites(prev =>
            wasFavorite
              ? (prev.includes(id) ? prev : [...prev, id])
              : prev.filter(favId => favId !== id)
          );
          const rollbackDelta = wasFavorite ? 1 : -1;
          const rollbackCount = (prev: Item[]) => prev.map(item =>
            item.id === id
              ? { ...item, favorite_count: Math.max(0, (item.favorite_count || 0) + rollbackDelta) }
              : item
          );
          setRecommendedItems(prev => rollbackCount(prev));
          setPopularItems(prev => rollbackCount(prev));
        }
      } finally {
        favoriteSyncTimersRef.current.delete(id);
      }
    }, 220);

    favoriteSyncTimersRef.current.set(id, timer);
  }, [user]);

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
          .select("id, title, selling_price, front_image_url, front_thumbnail_url, favorites(count), profiles!inner(department, major)")
          .eq("status", "available")
          .neq("seller_id", user.id)
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
        .select("id, title, selling_price, front_image_url, front_thumbnail_url, seller_id, favorites(count)")
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

  // Pull-to-Refresh handlers
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);

      try {
        // みんなの出品を再取得
        const { data: freshPopular } = await supabase
          .from("items")
          .select("id, title, selling_price, front_image_url, front_thumbnail_url, seller_id, favorites(count)")
          .eq("status", "available")
          .order("created_at", { ascending: false })
          .range(0, 14);

        if (freshPopular) {
          const mapped = (freshPopular as any[]).map(item => ({
            ...item,
            favorite_count: item.favorites?.[0]?.count || 0,
            favorites: undefined
          })) as Item[];
          setPopularItems(mapped);
        }
      } catch (err) {
        console.error("Refresh error:", err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing]);

  return (
    <div
      className="min-h-screen bg-white pb-24 font-gentle"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          height: pullDistance > 0 ? `${pullDistance}px` : '0px',
          opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
        }}
      >
        <RefreshCw
          className={`w-6 h-6 text-primary transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
          }}
        />
        <span className="ml-2 text-sm text-gray-500 font-medium">
          {isRefreshing ? t('home.refreshing') : pullDistance >= PULL_THRESHOLD ? t('home.pull_to_refresh') : t('home.pull_to_refresh')}
        </span>
      </div>

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
            <h1 className="text-3xl font-bold gradient-text-blue leading-none tracking-tight">
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
                {t('auth.login')}
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
              placeholder={t('home.search_placeholder')}
              className="w-full py-3 pl-12 pr-4 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none hover:border-primary/50 hover:bg-white transition-all cursor-pointer"
              readOnly
            />
          </div>
        </Link>
      </header>

      {/* おすすめの教材 */}
      {user && (
        <div className="px-6 py-8">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              {t('home.recommended')}
            </h2>
          </div>

          {loadingRecommended ? (
            <div className="text-center py-12">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">おすすめを読み込み中...</p>
            </div>
          ) : recommendedItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">同じ所属の出品はまだありません</p>
              <Link
                href="/listing"
                className="inline-block px-6 py-3 gradient-btn-blue rounded-xl font-semibold transition-all"
              >
                最初の出品者になる
              </Link>
            </div>
          ) : (
            <>
              <div className="relative ml-2 space-y-4 border-l border-sky-200/80 pl-5">
                {recommendedItems.map((item, index) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-5 top-8 h-px w-4 bg-sky-200" />
                    <div className="absolute -left-[25px] top-7 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-sky-200" />
                    <ItemCard
                      item={item}
                      isFavorite={favoriteSet.has(item.id)}
                      onToggleFavorite={toggleFavorite}
                      index={index}
                    />
                  </div>
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
                        {t('home.loading')}
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-5 h-5" />
                        {t('home.load_more')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* みんなの出品 */}
      {(displayedPopularItems.length > 0 || hasMore) && (
        <div className="px-6 py-8 bg-gray-50">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              {t('home.everyones_listings')}
            </h2>
          </div>

          <div className="relative ml-2 space-y-4 border-l border-emerald-200/80 pl-5">
            {displayedPopularItems.map((item, index) => (
              <div key={`popular-${item.id}`} className="relative">
                <div className="absolute -left-5 top-8 h-px w-4 bg-emerald-200" />
                <div className="absolute -left-[25px] top-7 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-emerald-200" />
                <ItemCard
                  item={item}
                  isFavorite={favoriteSet.has(item.id)}
                  onToggleFavorite={toggleFavorite}
                  index={index}
                />
              </div>
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
                    {t('home.loading')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-5 h-5" />
                    {t('home.load_more')}
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
