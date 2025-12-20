import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import MypageClient from "./client";

export const dynamic = "force-dynamic";

export default async function Mypage() {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookies().get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    try {
                        cookies().set({ name, value, ...options });
                    } catch (error) {
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookies().set({ name, value: "", ...options });
                    } catch (error) {
                    }
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return <MypageClient initialProfile={null} serverSession={false} initialListingItems={[]} initialPastItems={[]} initialFavoriteItems={[]} averageRating={0} ratingCount={0} />;
    }

    const userId = session.user.id;

    // Fetch data in parallel
    const [
        { data: profile },
        { data: ratingsData },
        { data: favoritesData },
        { data: sellerItems },
        { data: sellerTransactions }
    ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("ratings").select("score").eq("rated_id", userId),
        supabase.from("favorites").select("item_id, items(*)").eq("user_id", userId),
        supabase.from("items").select("*").eq("seller_id", userId),
        supabase.from("transactions").select("item_id, status").eq("seller_id", userId)
    ]);

    // Calculate average rating
    const scores = (ratingsData || []).map(r => r.score);
    const ratingCount = scores.length;
    const averageRating = ratingCount > 0 ? scores.reduce((a, b) => a + b, 0) / ratingCount : 0;

    // Filter listing items: selling status AND no transactions
    const txItemIds = new Set((sellerTransactions || []).map(tx => tx.item_id));
    const listingItems = (sellerItems || []).filter(item => item.status === 'selling' && !txItemIds.has(item.id));

    // Filter past items: sold status OR completed transaction
    const completedTxItemIds = new Set((sellerTransactions || []).filter(tx => tx.status === 'completed').map(tx => tx.item_id));
    const pastItems = (sellerItems || []).filter(item => item.status === 'sold' || completedTxItemIds.has(item.id));

    // Extract favorite items
    const favoriteItems = (favoritesData || []).map(f => f.items).filter(Boolean);

    return (
        <MypageClient 
            initialProfile={profile as any}
            serverSession={true}
            initialListingItems={listingItems as any[]}
            initialPastItems={pastItems as any[]}
            initialFavoriteItems={favoriteItems as any[]}
            averageRating={averageRating}
            ratingCount={ratingCount}
        />
    );
}
