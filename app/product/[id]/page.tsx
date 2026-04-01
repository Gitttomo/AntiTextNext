import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProductDetailClient, { Item } from "./client";

// Phase 2: 適切なキャッシュ戦略
// 30秒ごとに再検証することで、削除されたアイテムが長時間表示されるのを防ぐ
// ISRの60秒から30秒に短縮し、削除反映を早める
export const revalidate = 30;

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
    
    const itemFields = "id, title, selling_price, original_price, status, front_image_url, back_image_url, created_at, seller_id";

    // 1. Fetch item and profile
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select(`${itemFields}, profiles!items_seller_id_fkey_profiles(nickname, avatar_url, department, major, degree, grade)`)
      .eq("id", id)
      .single();

    if (itemError || !itemData) {
      console.error("Error loading item:", itemError);
      return <ErrorDisplay message={itemError ? "商品の読み込みに失敗しました" : "商品が見つかりませんでした"} />;
    }

    const sellerId = (itemData as any).seller_id;

    // 2. Fetch ratings in parallel
    const { data: ratingsData } = await supabase
      .from("ratings")
      .select("score")
      .eq("rated_id", sellerId);

    const scores = (ratingsData as any[] || []).map(r => r.score);
    const ratingCount = scores.length;
    const averageRating = ratingCount > 0 ? scores.reduce((a, b) => a + b, 0) / ratingCount : 0;

    const profile = (itemData as any).profiles;
    let avatarUrl = profile?.avatar_url;
    if (avatarUrl && !avatarUrl.startsWith('http')) {
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(avatarUrl);
      avatarUrl = publicUrl;
    }

    fullItem = { 
      ...(itemData as any), 
      seller_nickname: profile?.nickname || "匿名",
      seller_avatar_url: avatarUrl,
      seller_department: profile?.department,
      seller_major: profile?.major,
      seller_rating: averageRating,
      seller_rating_count: ratingCount
    };

    return <ProductDetailClient item={fullItem as any} />;

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
