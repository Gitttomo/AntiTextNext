import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import MypageClient from "./client";
import { isCurrentUserAdmin } from "@/lib/admin";

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
        return <MypageClient initialProfile={null} serverSession={false} initialListingItems={[]} initialPastItems={[]} initialFavoriteItems={[]} averageRating={0} ratingCount={0} isAdmin={false} />;
    }

    const userId = session.user.id;
    const isAdmin = await isCurrentUserAdmin(supabase as any);

    // Fetch data in parallel
    const [
        { data: profile },
        { data: ratingsData },
        { data: favoritesData },
        { data: sellerItems },
        { data: sellerTransactions },
        { data: buyerTransactions }
    ] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("ratings").select("score").eq("rated_id", userId),
        supabase.from("favorites").select("item_id, items(*)").eq("user_id", userId),
        supabase.from("items").select("*").eq("seller_id", userId),
        supabase.from("transactions").select("item_id, status").eq("seller_id", userId),
        supabase
            .from("transactions")
            .select("item_id, status, items(*)")
            .eq("buyer_id", userId)
    ]);

    // Calculate average rating
    const scores = (ratingsData || []).map(r => r.score);
    const ratingCount = scores.length;
    const averageRating = ratingCount > 0 ? scores.reduce((a, b) => a + b, 0) / ratingCount : 0;

    // Filter listing items: available status AND no transactions
    const txItemIds = new Set((sellerTransactions || []).map(tx => tx.item_id));
    const listingItems = (sellerItems || []).filter(item => item.status === 'available' && !txItemIds.has(item.id));

    // Filter past items: sold status OR completed transaction
    const completedTxItemIds = new Set((sellerTransactions || []).filter(tx => tx.status === 'completed').map(tx => tx.item_id));
    const sellerPastItems = (sellerItems || []).filter(item => item.status === 'sold' || completedTxItemIds.has(item.id));
    const buyerPastItems = ((buyerTransactions || []) as any[])
        .filter(tx => tx.status === 'completed' || tx.items?.status === 'sold')
        .map(tx => tx.items)
        .filter(Boolean);
    const pastItems = Array.from(
        new Map([...sellerPastItems, ...buyerPastItems].map((item: any) => [item.id, item])).values()
    );

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
            isAdmin={isAdmin}
        />
    );
}
