import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProductDetailClient, { Item } from "./client";

// ISR (Incremental Static Regeneration) を有効化（60秒キャッシュ）
// これにより、データベースへのアクセス頻度が減り、レスポンスが高速化されます
export const revalidate = 60;

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  try {
    // 2. Fetch profile
    // Attempt to join first (Optimized path)
    let fullItem: Item | null = null;
    
    // 必要なフィールドのみを選択してペイロードサイズを削減
    const itemFields = "id, title, selling_price, original_price, condition, status, front_image_url, back_image_url, created_at, seller_id";

    try {
      const { data: joinedData, error: joinedError } = await supabase
        .from("items")
        .select(`${itemFields}, profiles!items_seller_id_fkey_profiles(nickname)`)
        .eq("id", id)
        .single();

      if (!joinedError && joinedData) {
        // Optimized path succeeded
        const nickname = (joinedData as any).profiles?.nickname || "匿名";
        fullItem = { ...(joinedData as any), seller_nickname: nickname };
      }
    } catch (e) {
      // Ignore error and fall back
    }

    if (!fullItem) {
      // Fallback: Sequential fetch (if FK not added yet)
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select(itemFields)
        .eq("id", id)
        .single();

      if (itemError || !itemData) {
        console.error("Error loading item:", itemError);
        return <ErrorDisplay message={itemError ? "商品の読み込みに失敗しました" : "商品が見つかりませんでした"} />;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("user_id", (itemData as any).seller_id)
        .single();

      const nickname = (profileData as any)?.nickname || "匿名";
      fullItem = { ...(itemData as any), seller_nickname: nickname };
    }

    return <ProductDetailClient item={fullItem as Item} />;

  } catch (err) {
    console.error("Error in ProductDetailPage:", err);
    return <ErrorDisplay message="予期せぬエラーが発生しました" />;
  }
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">{message}</p>
        <Link href="/" className="text-primary hover:underline">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}
