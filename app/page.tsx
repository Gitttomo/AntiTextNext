import { supabase } from "@/lib/supabase";
import HomeClient from "./home-client";

// Phase 2: 適切なキャッシュ戦略
// 30秒ごとに再検証することで、パフォーマンスを維持しつつ削除反映を早める
// クライアント側でも useEffect で最新データを取得するため、実質的にはより早く反映される
export const revalidate = 30;

export default async function HomePage() {
  
  // おすすめの教材（最新10件）
  // reserved, transaction_pending, soldの商品を除外
  const { data: recommendedData, error: recommendedError } = await supabase
    .from("items")
    .select("id, title, selling_price, front_image_url, favorites(count)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(10);

  // みんなの出品（新着順 上位15件）
  const { data: popularData, error: popularError } = await supabase
    .from("items")
    .select("id, title, selling_price, front_image_url, favorites(count)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .range(0, 14);

  // 出品物の総数を取得
  const { count: totalCount } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  if (recommendedError) {
    console.error("Error loading recommended items:", recommendedError);
  }
  if (popularError) {
    console.error("Error loading popular items:", popularError);
  }

  const mapItems = (data: any[] | null) => {
    return (data || []).map(item => ({
      ...item,
      favorite_count: item.favorites?.[0]?.count || 0,
      favorites: undefined // Clean up the object
    }));
  };

  return (
    <HomeClient 
      items={mapItems(recommendedData)} 
      popularItems={mapItems(popularData)}
      totalPopularCount={totalCount || 0}
    />
  );
}
