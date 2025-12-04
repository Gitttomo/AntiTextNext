"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

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
            .eq("user_id", itemData.seller_id)
            .single();
          if (profileData?.nickname) {
            nickname = profileData.nickname;
          }
        } catch {
          // Profile not found, use default
        }

        setItem({ ...itemData, seller_nickname: nickname });
      }
    } catch (err) {
      console.error("Error loading item:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    router.push(`/chat/${params.id}`);
  };

  const handlePurchase = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (confirm("この教科書を購入しますか？")) {
      try {
        const { error } = await supabase
          .from("items")
          .update({ status: "sold" })
          .eq("id", params.id);

        if (error) throw error;

        alert("購入が完了しました！出品者とチャットで待ち合わせ場所を決めてください。");
        router.push(`/chat/${params.id}`);
      } catch (err: any) {
        alert("購入に失敗しました: " + err.message);
      }
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
            ホームへ戻る
          </Link>
        </div>
      </div>
    );
  }

  const isSold = item.status === "sold";
  const isOwnItem = user?.id === item.seller_id;

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-6 border-b">
        <Link href="/">
          <ArrowLeft className="w-6 h-6 text-gray-600 hover:text-primary transition-colors" />
        </Link>
      </header>

      {/* Product Images */}
      <div className="px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {item.front_image_url && (
              <div className="aspect-[3/4] rounded-2xl overflow-hidden border shadow-lg">
                <img
                  src={item.front_image_url}
                  alt="表紙"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {item.back_image_url && (
              <div className="aspect-[3/4] rounded-2xl overflow-hidden border shadow-lg">
                <img
                  src={item.back_image_url}
                  alt="裏表紙"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Product Info Card */}
          <div className="bg-white rounded-2xl border shadow-lg p-8">
            <div className="space-y-6">
              {isSold && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-600 font-semibold text-center">
                    この商品は売り切れました
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  教材名
                </h3>
                <h1 className="text-2xl font-bold text-gray-900">
                  {item.title}
                </h1>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  状態
                </h3>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {item.condition}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  価格
                </h3>
                <p className="text-4xl font-bold text-primary">
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
                <p className="text-lg font-semibold text-gray-900">
                  {item.seller_nickname || "匿名"}
                </p>
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

      {/* Action Buttons */}
      {!isOwnItem && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-4 safe-area-bottom">
          <div className="max-w-4xl mx-auto flex gap-4">
            <button
              onClick={handleStartChat}
              className="flex-1 py-4 bg-white border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              チャット
            </button>
            <button
              onClick={handlePurchase}
              disabled={isSold}
              className="flex-1 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
            >
              {isSold ? "売り切れ" : "購入する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
