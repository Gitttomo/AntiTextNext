import { supabase } from "@/lib/supabase";
import HomeClient from "./home-client";

// ISR (Incremental Static Regeneration) を有効化（60秒キャッシュ）
export const revalidate = 60;

export default async function HomePage() {
  const { data, error } = await supabase
    .from("items")
    .select("id, title, selling_price, condition")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error loading items:", error);
    return <HomeClient items={[]} />;
  }

  return <HomeClient items={(data as any) || []} />;
}
