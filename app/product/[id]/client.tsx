"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  condition: string;
  status: string;
  front_image_url: string | null;
  back_image_url: string | null;
  created_at: string;
  seller_id: string;
  seller_nickname?: string;
};

export default function ProductDetailClient({ item }: { item: Item }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We don't need loading state or fetch logic here as item is passed from server

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
              <div className="relative aspect-[3/4] bg-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <Image
                  src={item.front_image_url}
                  alt={`${item.title} 表紙`}
                  fill
                  sizes="(max-width: 768px) 40vw, 300px"
                  className="object-cover"
                  loading="eager"
                  quality={50}
                  onLoad={(e) => {
                    (e.target as HTMLElement).parentElement?.classList.remove('animate-pulse', 'bg-gray-200');
                    (e.target as HTMLElement).parentElement?.classList.add('bg-gray-100');
                  }}
                />
              </div>
            )}
            {item.back_image_url && (
              <div className="relative aspect-[3/4] bg-gray-200 rounded-2xl overflow-hidden animate-pulse">
                <Image
                  src={item.back_image_url}
                  alt={`${item.title} 裏表紙`}
                  fill
                  sizes="(max-width: 768px) 40vw, 300px"
                  className="object-cover"
                  loading="lazy"
                  quality={50}
                  onLoad={(e) => {
                    (e.target as HTMLElement).parentElement?.classList.remove('animate-pulse', 'bg-gray-200');
                    (e.target as HTMLElement).parentElement?.classList.add('bg-gray-100');
                  }}
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
      <PurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSubmit={handlePurchaseSubmit}
        itemTitle={item.title}
      />
    </div>
  );
}
