import { supabase } from "@/lib/supabase";
import HomeClient from "./home-client";

// ISR (Incremental Static Regeneration) を有効化（60秒キャッシュ）
export const revalidate = 60;

export default async function HomePage() {
  // おすすめの教材（最新10件）
  const { data: recommendedData, error: recommendedError } = await supabase
    .from("items")
    .select("id, title, selling_price, condition, front_image_url")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(10);

  // みんなの出品（新着順 上位15件）
  const { data: popularData, error: popularError } = await supabase
    .from("items")
    .select("id, title, selling_price, condition, front_image_url")
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

  return (
    <HomeClient 
      items={(recommendedData as any) || []} 
      popularItems={(popularData as any) || []}
      totalPopularCount={totalCount || 0}
    />
  );
}
