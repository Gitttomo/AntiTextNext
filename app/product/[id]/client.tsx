"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShoppingCart, X, Search, User, Star, GraduationCap, Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { PurchaseData, generatePurchaseMessage } from "@/components/purchase-utils";

const PurchaseModal = dynamic(() => import('@/components/PurchaseModal'), { ssr: false });

export type Item = {
  id: string;
  title: string;
  selling_price: number;
  original_price: number;
  //condition: string;
  status: string;
  front_image_url: string | null;
  back_image_url: string | null;
  created_at: string;
  seller_id: string;
  seller_nickname?: string;
  seller_avatar_url?: string;
};

export default function ProductDetailClient({ item }: { item: Item }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const isLockedRef = useRef(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // お気に入り状態を取得
  useEffect(() => {
    if (!user || !item) return;
    const checkFavorite = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_id", item.id)
        .maybeSingle();
      setIsFavorite(!!data);
    };
    checkFavorite();
  }, [user, item]);

  const toggleFavorite = async () => {
    if (!user || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      if (isFavorite) {
        await (supabase.from("favorites") as any)
          .delete()
          .eq("user_id", user.id)
          .eq("item_id", item.id);
        setIsFavorite(false);
      } else {
        await (supabase.from("favorites") as any)
          .insert({ user_id: user.id, item_id: item.id });
        setIsFavorite(true);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    } finally {
      setFavoriteLoading(false);
    }
  };

  useEffect(() => {
    isLockedRef.current = !!lockedUntil;
  }, [lockedUntil]);

  const handleReleaseLock = async () => {
    if (!user || !item) return;
    try {
      await (supabase as any).rpc("release_item_lock", {
        target_item_id: item.id,
        locker_id: user.id
      });
    } catch (err) {
      console.error("Error releasing lock:", err);
    }
  };

  useEffect(() => {
    setIsVisible(true);
    // モーダル表示時に背景のスクロールを固定
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('hide-bottom-nav');
      if (isLockedRef.current) {
        handleReleaseLock();
      }
    };
  }, []);

  // モーダル状態に合わせてナビゲーションの表示を制御
  useEffect(() => {
    if (isPurchaseModalOpen) {
      document.body.classList.add('hide-bottom-nav');
    } else {
      document.body.classList.remove('hide-bottom-nav');
    }
  }, [isPurchaseModalOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      router.back();
    }, 300);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleOpenPurchaseModal = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const now = new Date().toISOString();
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    
    try {
      // Attempt to acquire lock via RPC (more secure & bypasses RLS issues)
      const { data: success, error } = await (supabase as any).rpc("acquire_item_lock", {
        target_item_id: item.id,
        locker_id: user.id,
        lock_until: tenMinutesLater
      });

      if (error) throw error;

      if (!success) {
        alert("現在、他の方が手続き中です。1分後にもう一度お試しください。");
        return;
      }

      setLockedUntil(tenMinutesLater);
      setIsPurchaseModalOpen(true);
    } catch (err: any) {
      console.error("Error acquiring lock:", err);
      // Detailed error for debugging
      if (err.message?.includes('function acquire_item_lock') || err.message?.includes('column "locked_by" does not exist')) {
        alert("システムエラー：データベースの更新（マイグレーション）が未完了です。SQL Editorで最新のSQLを実行してください。");
      } else {
        alert("購入手続きの開始に失敗しました。時間をおいて再度お試しください。");
      }
    }
  };

  const handleModalClose = () => {
    setIsPurchaseModalOpen(false);
    handleReleaseLock();
  };

  const handlePurchaseSubmit = async (data: PurchaseData) => {
    if (!user || !item) return;

    setIsSubmitting(true);

    try {
      // Create transaction
      const { error: transactionError } = await (supabase
        .from("transactions") as any)
        .insert({
          item_id: item.id,
          buyer_id: user.id,
          seller_id: item.seller_id,
          payment_method: data.paymentMethod,
          meetup_time_slots: data.timeSlots,
          meetup_locations: data.locations,
          status: "pending",
        });

      if (transactionError) throw transactionError;

      // Update item status and release lock
      const { error: updateError } = await (supabase
        .from("items") as any)
        .update({ 
          status: "transaction_pending",
          locked_by: null,
          locked_until: null
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      const autoMessage = generatePurchaseMessage(data);
      const { error: messageError } = await (supabase
        .from("messages") as any)
        .insert({
          item_id: item.id,
          sender_id: user.id,
          receiver_id: item.seller_id,
          message: autoMessage,
          is_read: false,
        });

      if (messageError) throw messageError;

      // Get buyer's nickname for notification
      const { data: buyerProfile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", user.id)
        .single();

      const buyerNickname = (buyerProfile as any)?.nickname || "購入者";

      // Send notification to seller
      const { error: notificationError } = await (supabase
        .from("notifications") as any)
        .insert({
          user_id: item.seller_id,
          type: "purchase_request",
          title: "新しい購入リクエスト",
          message: `${buyerNickname}さんから購入リクエストが届きました。チャットで日程を調整してください。`,
          link_type: "chat",
          link_id: item.id,
          is_read: false,
        });

      if (notificationError) {
        console.error("Failed to send notification:", notificationError);
        // Don't block the flow if notification fails
      }

      setIsPurchaseModalOpen(false);
      // チャットはitem_idベースに変更
      router.push(`/chat/${item.id}`);
    } catch (err: any) {
      console.error("Error submitting purchase request:", err);
      alert("購入リクエストの送信に失敗しました: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* const conditionLabel = {
    new: "新品・未使用",
    like_new: "ほぼ新品",
    good: "やや傷あり",
    fair: "傷あり",
  }[item.condition] || item.condition; */

  const isOwnItem = user?.id === item.seller_id;
  const isSold = item.status === "sold";
  const isPending = item.status === "transaction_pending";
  const isReserved = item.status === "reserved";
  const isAvailable = item.status === "available";

  // 他のユーザーが予約中または取引中の商品にアクセスした場合
  const isReservedByOther = (isReserved || isPending) && !isOwnItem;

  // If item is reserved by another user, show blocked message
  if (isReservedByOther) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center animate-[slideUp_0.3s_ease-out]">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isPending ? "取引中" : "予約済み"}
          </h2>
          <p className="text-gray-600 mb-6">
            {isPending
              ? "この商品は現在取引中です。"
              : "この商品は他のユーザーが購入手続き中です。しばらくお待ちください。"
            }
          </p>
          <Link
            href="/"
            className="block w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50" onClick={handleBackdropClick}>
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible && !isClosing ? 'opacity-50' : 'opacity-0'
        }`}
      />
      
      {/* Modal Content - Bottom Sheet */}
      <div 
        className={`absolute inset-x-0 bottom-20 top-14 bg-white rounded-t-3xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${
          isVisible && !isClosing ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-6 pt-4 pb-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="戻る"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">商品詳細</h1>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Scrollable content */}
        <div className="overflow-y-auto h-[calc(100%-130px)] px-6 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Images - Swipe Carousel */}
            {(item.front_image_url || item.back_image_url) && (() => {
              const images = [
                item.front_image_url ? { url: item.front_image_url, label: "表紙" } : null,
                item.back_image_url ? { url: item.back_image_url, label: "裏表紙" } : null,
              ].filter(Boolean) as { url: string; label: string }[];

              return (
                <div className="mb-6">
                  <div
                    className="relative overflow-hidden rounded-2xl bg-gray-100"
                    onTouchStart={(e) => {
                      const t = e.currentTarget as any;
                      t._touchStartX = e.touches[0].clientX;
                      t._touchStartTime = Date.now();
                    }}
                    onTouchEnd={(e) => {
                      const t = e.currentTarget as any;
                      if (!t._touchStartX) return;
                      const diff = e.changedTouches[0].clientX - t._touchStartX;
                      const elapsed = Date.now() - (t._touchStartTime || 0);
                      // Swipe threshold: 50px or fast swipe
                      if (Math.abs(diff) > 50 || (Math.abs(diff) > 20 && elapsed < 250)) {
                        const carousel = t.querySelector('[data-carousel]');
                        if (!carousel) return;
                        const currentIdx = Math.round(carousel.scrollLeft / carousel.offsetWidth);
                        const nextIdx = diff < 0
                          ? Math.min(currentIdx + 1, images.length - 1)
                          : Math.max(currentIdx - 1, 0);
                        carousel.scrollTo({ left: nextIdx * carousel.offsetWidth, behavior: 'smooth' });
                      }
                      t._touchStartX = null;
                    }}
                  >
                    <div
                      data-carousel
                      className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const idx = Math.round(el.scrollLeft / el.offsetWidth);
                        const dots = el.parentElement?.querySelectorAll('[data-dot]');
                        dots?.forEach((dot, i) => {
                          (dot as HTMLElement).style.opacity = i === idx ? '1' : '0.4';
                          (dot as HTMLElement).style.width = i === idx ? '20px' : '8px';
                        });
                      }}
                    >
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          className="flex-none w-full snap-center"
                        >
                          <div
                            className="relative aspect-[3/4] cursor-zoom-in group"
                            onClick={() => setZoomedImage(img.url)}
                          >
                            <Image
                              src={img.url}
                              alt={`${item.title} ${img.label}`}
                              fill
                              sizes="(max-width: 768px) 90vw, 600px"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              loading={idx === 0 ? "eager" : "lazy"}
                              quality={70}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-md p-2 rounded-full">
                                <Search className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            {/* Image label */}
                            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                              {img.label}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Dot Indicators */}
                    {images.length > 1 && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                        {images.map((_, idx) => (
                          <div
                            key={idx}
                            data-dot
                            className="h-2 rounded-full bg-white shadow-sm transition-all duration-300"
                            style={{
                              width: idx === 0 ? '20px' : '8px',
                              opacity: idx === 0 ? 1 : 0.4,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Product Info */}
            <div className="bg-white rounded-2xl shadow-lg border p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h2>

              {(isSold || isPending) && (
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-4 ${
                  isSold ? "bg-gray-200 text-gray-600" : "bg-yellow-100 text-yellow-700"
                }`}>
                  {isSold ? "売り切れ" : "取引中"}
                </div>
              )}

              <div className="space-y-4">
                {/* <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">状態</h3>
                  <span className="inline-block bg-gray-100 px-3 py-1 rounded-full text-sm">
                    {conditionLabel}
                  </span>
                </div> */}

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">価格</h3>
                  <p className="text-3xl font-bold text-primary">
                    ¥{item.selling_price.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    定価: ¥{item.original_price.toLocaleString()}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">出品者</h3>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 space-y-3">
                    <Link
                      href={`/seller/${item.seller_id}`}
                      className="flex items-center gap-3 group transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors overflow-hidden border-2 border-white shadow-sm">
                        {item.seller_avatar_url ? (
                          <Image
                            src={item.seller_avatar_url}
                            alt={item.seller_nickname || "出品者"}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors truncate">
                            {item.seller_nickname || "匿名"}
                          </span>
                        </div>
                        {(item as any).seller_rating !== undefined && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex text-yellow-500">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${i < Math.round((item as any).seller_rating || 0) ? "fill-current" : "text-gray-200"}`} 
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-gray-500">
                              {((item as any).seller_rating || 0).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                    
                    <div className="pt-2 border-t border-gray-200/60 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <GraduationCap className="w-4 h-4 text-primary/60" />
                        <span className="font-medium">{(item as any).seller_department || "不明"}</span>
                      </div>
                      {(item as any).seller_major && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 pl-6">
                          <span className="text-xs bg-primary/5 text-primary px-2 py-0.5 rounded-md font-bold">{(item as any).seller_major}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">出品日</h3>
                  <p className="text-gray-900 font-medium">
                    {new Date(item.created_at).toLocaleDateString("ja-JP", { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom of modal */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-6 py-4 z-[60]">
          <div className="max-w-4xl mx-auto flex gap-3">
            {isOwnItem ? (
              <div className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-center">
                自分の出品商品です
              </div>
            ) : (
              <>
                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading || !user}
                  className={`w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-all active:scale-90 ${
                    isFavorite
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50"
                  }`}
                  aria-label="お気に入り"
                >
                  <Heart
                    className={`w-6 h-6 transition-colors ${
                      isFavorite
                        ? "fill-red-500 text-red-500"
                        : "text-gray-400"
                    }`}
                  />
                </button>
                <button
                  onClick={handleOpenPurchaseModal}
                  disabled={!isAvailable}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {isSold ? "売り切れ" : isPending ? "取引中" : "購入する"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Zoomed Image Overlay */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12 animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setZoomedImage(null)}
        >
          <button 
            className="absolute top-12 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[110]"
            onClick={() => setZoomedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div 
            className="relative w-full h-full max-w-4xl max-h-[90vh] flex items-center justify-center overflow-hidden animate-[pinchOut_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={zoomedImage}
              alt="拡大画像"
              fill
              className="object-contain"
              quality={100}
              priority
            />
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={handleModalClose}
        onSubmit={handlePurchaseSubmit}
        itemTitle={item.title}
        lockedUntil={lockedUntil}
      />
    </div>
  );
}
