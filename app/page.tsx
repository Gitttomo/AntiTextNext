import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import HomeClient from "./home-client";

// Phase 2: 適切なキャッシュ戦略
export const revalidate = 30;

export default async function HomePage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );

  // セッション取得（自分の出品を除外するため）
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // みんなの出品（新着順 上位15件）— 自分の出品を除外
  let popularQuery = supabase
    .from("items")
    .select("id, title, selling_price, front_image_url, favorites(count)")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .range(0, 14);

  if (userId) {
    popularQuery = popularQuery.neq("seller_id", userId);
  }

  const { data: popularData, error: popularError } = await popularQuery;

  // 出品物の総数を取得
  let countQuery = supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("status", "available");

  if (userId) {
    countQuery = countQuery.neq("seller_id", userId);
  }

  const { count: totalCount } = await countQuery;

  if (popularError) {
    console.error("Error loading popular items:", popularError);
  }

  const mapItems = (data: any[] | null) => {
    return (data || []).map(item => ({
      ...item,
      favorite_count: item.favorites?.[0]?.count || 0,
      favorites: undefined
    }));
  };

  return (
    <HomeClient 
      items={[]} 
      popularItems={mapItems(popularData)}
      totalPopularCount={totalCount || 0}
    />
  );
}
