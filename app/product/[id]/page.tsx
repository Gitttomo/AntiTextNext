/**
 * 商品詳細ページ
 * 
 * 出品されている教科書の詳細情報を表示するページです。
 * 
 * 機能:
 * - 商品情報（タイトル、価格、状態、出品者）の表示
 * - 商品画像の表示
 * - 購入リクエストモーダルの表示
 * - 取引の作成とチャットへの遷移
 * 
 * 自分の出品商品の場合は購入ボタンが表示されません。
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import PurchaseModal, { PurchaseData, generatePurchaseMessage } from "@/components/PurchaseModal";

// 商品情報の型定義
type Item = {
  id: string;
  title: string;
  selling_price: number;
  original_price: number;
  condition: string;
  status: string;
  front_image_url: string | null;
  back_image_url: string | null;
  created_at: string;
  seller_id: string;
  seller_nickname?: string;
};

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadItem();
  }, [params.id]);

  const loadItem = async () => {
    try {
      // First get the item
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("id", params.id)
        .single();

      if (itemError) {
        console.error("Error loading item:", itemError);
        setLoading(false);
        return;
      }

      if (itemData) {
        // Then try to get the seller's nickname
        let nickname = "匿名";
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("user_id", (itemData as any).seller_id)
            .single();
          if ((profileData as any)?.nickname) {
            nickname = (profileData as any).nickname;
          }
        } catch {
          // Profile not found, use default
        }

        setItem({ ...(itemData as any), seller_nickname: nickname });
      }
    } catch (err) {
      console.error("Error loading item:", err);
    } finally {
      setLoading(false);
    }
  };



  const handleOpenPurchaseModal = () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    setIsPurchaseModalOpen(true);
  };

  const handlePurchaseSubmit = async (data: PurchaseData) => {
    if (!user || !item) return;

    setIsSubmitting(true);

    try {
      // 1. Create transaction record and get ID
      const { data: transactionData, error: transactionError } = await (supabase
        .from("transactions") as any)
        .insert({
          item_id: item.id,
          buyer_id: user.id,
          seller_id: item.seller_id,
          payment_method: data.paymentMethod,
          meetup_time_slots: data.timeSlots,
          meetup_locations: data.locations,
          status: "pending",
        })
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      const transactionId = transactionData.id;

      // 2. Update item status to transaction_pending
      const { error: updateError } = await (supabase
        .from("items") as any)
        .update({ status: "transaction_pending" })
        .eq("id", item.id);

      if (updateError) throw updateError;

      // 3. Send auto-message to chat (linked to transaction)
      const autoMessage = generatePurchaseMessage(data);
      const { error: messageError } = await (supabase
        .from("messages") as any)
        .insert({
          item_id: item.id,
          transaction_id: transactionId,
          sender_id: user.id,
          receiver_id: item.seller_id,
          message: autoMessage,
        });

      if (messageError) throw messageError;

      // 4. Close modal and redirect to transaction chat
      setIsPurchaseModalOpen(false);
      router.push(`/chat/${transactionId}`);
    } catch (err: any) {
      console.error("Error submitting purchase request:", err);
      alert("購入リクエストの送信に失敗しました: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">商品が見つかりませんでした</p>
          <Link href="/" className="text-primary hover:underline">
            ホームに戻る
          </Link>
        </div>
      </div>
    );
  }

  const conditionLabel = {
    new: "新品・未使用",
    like_new: "ほぼ新品",
    good: "やや傷あり",
    fair: "傷あり",
  }[item.condition] || item.condition;

  const isOwnItem = user?.id === item.seller_id;
  const isSold = item.status === "sold";
  const isPending = item.status === "transaction_pending";
  const isAvailable = item.status === "available";

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <div className="flex items-center gap-4">
          <Link href="/">
            <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">商品詳細</h1>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Images */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {item.front_image_url && (
              <div className="relative aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden">
                <Image
                  src={item.front_image_url}
                  alt={`${item.title} 表紙`}
                  fill
                  sizes="(max-width: 768px) 50vw, 400px"
                  className="object-cover"
                  priority
                />
              </div>
            )}
            {item.back_image_url && (
              <div className="relative aspect-[3/4] bg-gray-100 rounded-2xl overflow-hidden">
                <Image
                  src={item.back_image_url}
                  alt={`${item.title} 裏表紙`}
                  fill
                  sizes="(max-width: 768px) 50vw, 400px"
                  className="object-cover"
                />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="bg-white rounded-2xl shadow-lg border p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h2>

            {/* Status Badge */}
            {(isSold || isPending) && (
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-4 ${isSold ? "bg-gray-200 text-gray-600" : "bg-yellow-100 text-yellow-700"
                }`}>
                {isSold ? "売り切れ" : "取引中"}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  状態
                </h3>
                <span className="inline-block bg-gray-100 px-3 py-1 rounded-full text-sm">
                  {conditionLabel}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  価格
                </h3>
                <p className="text-3xl font-bold text-primary">
                  ¥{item.selling_price.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  定価: ¥{item.original_price.toLocaleString()}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  出品者
                </h3>
                <Link
                  href={`/seller/${item.seller_id}`}
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  {item.seller_nickname || "匿名"}
                </Link>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  出品日
                </h3>
                <p className="text-gray-900">
                  {new Date(item.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Above BottomNav */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t px-6 py-4 z-40">
        <div className="max-w-4xl mx-auto flex gap-4">
          {isOwnItem ? (
            <div className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-xl font-semibold text-center">
              自分の出品商品です
            </div>
          ) : (
            <button
              onClick={handleOpenPurchaseModal}
              disabled={!isAvailable}
              className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              {isSold ? "売り切れ" : isPending ? "取引中" : "購入リクエストへ進む"}
            </button>
          )}
        </div>
      </div>

      {/* Purchase Modal */}
      {item && (
        <PurchaseModal
          isOpen={isPurchaseModalOpen}
          onClose={() => setIsPurchaseModalOpen(false)}
          onSubmit={handlePurchaseSubmit}
          itemTitle={item.title}
        />
      )}
    </div>
  );
}
