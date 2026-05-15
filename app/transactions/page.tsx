import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import TransactionsClient from "./transactions-client";
import { resolveEarlyRegistrationEligible } from "@/lib/rewards";

export const dynamic = "force-dynamic";

type TransactionItem = {
    id: string;
    title: string;
    selling_price: number;
    status: string;
    front_image_url: string | null;
    front_thumbnail_url?: string | null;
    front_image_storage_path?: string | null;
    front_thumbnail_storage_path?: string | null;
    image_storage_provider?: string | null;
    isBuyer: boolean;
    hasTransaction: boolean;
    unreadCount: number;
    final_meetup_time?: string | null;
    final_meetup_location?: string | null;
    transactionId?: string;
    counterpartId?: string;
    transactionStatus?: string;
};

const TERMINAL_TRANSACTION_STATUSES = ["completed", "rejected", "expired", "auto_closed", "cancelled"];
const unreadKey = (itemId: string, counterpartId?: string | null) => `${itemId}:${counterpartId || ""}`;

export default async function TransactionsPage() {
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
                        // Handle potential error in Server Components
                    }
                },
                remove(name: string, options: any) {
                    try {
                        cookies().set({ name, value: "", ...options });
                    } catch (error) {
                        // Handle potential error in Server Components
                    }
                },
            },
        }
    );
    
    // getSession() instead of getUser() for performance, 
    // but check getUser() if session exists for security if needed.
    const { data: { session } } = await supabase.auth.getSession();

    // If no session on server, pass nulls and let client handle redirect if not logged in.
    // This prevents "false positive" redirects to login page when cookies are missing but localStorage has session.
    if (!session) {
        return (
            <TransactionsClient
                initialActiveItems={[]}
                initialProfile={null}
                initialListingCount={0}
                initialEarlyRegistrationEligible={false}
                serverSession={false}
            />
        );
    }

    const userId = session.user.id;

    // Parallel data fetching on the server
    const [
        { data: profileData },
        { data: buyerTransactions },
        { data: sellerItems },
        { data: sellerTransactions },
        { data: unreadMessages },
        { data: rewardSetting },
        { data: rewardOverride }
    ] = await Promise.all([
        supabase
            .from("profiles")
            .select("nickname, department")
            .eq("user_id", userId)
            .single(),
        supabase
            .from("transactions")
            .select(`
                id,
                status,
                item_id,
                seller_id,
                final_meetup_time,
                final_meetup_location,
                items(id, title, selling_price, status, front_image_url, front_thumbnail_url, front_image_storage_path, front_thumbnail_storage_path, image_storage_provider)
            `)
            .eq("buyer_id", userId),
        supabase
            .from("items")
            .select("id, title, selling_price, status, seller_id, front_image_url, front_thumbnail_url, front_image_storage_path, front_thumbnail_storage_path, image_storage_provider")
            .eq("seller_id", userId),
        supabase
            .from("transactions")
            .select("id, item_id, buyer_id, status, final_meetup_time, final_meetup_location")
            .eq("seller_id", userId),
        supabase
            .from("messages")
            .select("item_id,sender_id")
            .eq("receiver_id", userId)
            .eq("is_read", false),
        (supabase as any)
            .from("reward_settings")
            .select("*")
            .eq("id", "early_registration")
            .single(),
        (supabase as any)
            .from("user_reward_overrides")
            .select("early_registration_override")
            .eq("user_id", userId)
            .maybeSingle()
    ]);

    // Data processing (mirrored from client logic for consistency)
    const unreadCountMap = new Map<string, number>();
    if (unreadMessages) {
        for (const msg of unreadMessages as any[]) {
            const key = unreadKey(msg.item_id, msg.sender_id);
            const count = unreadCountMap.get(key) || 0;
            unreadCountMap.set(key, count + 1);
        }
    }

    const active: TransactionItem[] = [];
    const cumulativeListingCount = (sellerItems || []).filter((item: any) => item.status !== "deleted").length;

    // Process Buyer Transactions
    for (const tx of (buyerTransactions || []) as any[]) {
        const item = tx.items;
        if (!item) continue;

        if (TERMINAL_TRANSACTION_STATUSES.includes(tx.status) || item.status === "sold") {
            continue;
        }

        const txItem: TransactionItem = {
            id: item.id,
            title: item.title,
            selling_price: item.selling_price,
            status: item.status,
            front_image_url: item.front_image_url || null,
            front_thumbnail_url: item.front_thumbnail_url || null,
            front_image_storage_path: item.front_image_storage_path || null,
            front_thumbnail_storage_path: item.front_thumbnail_storage_path || null,
            image_storage_provider: item.image_storage_provider || null,
            isBuyer: true,
            hasTransaction: true,
            unreadCount: unreadCountMap.get(unreadKey(item.id, tx.seller_id)) || 0,
            final_meetup_time: tx.final_meetup_time,
            final_meetup_location: tx.final_meetup_location,
            transactionId: tx.id,
            counterpartId: tx.seller_id,
            transactionStatus: tx.status,
        };

        active.push(txItem);
    }

    // Process Seller Items & Transactions
    const sellerTxMap = new Map<string, { txId: string; buyerId: string; txStatus: string; final_meetup_time: string | null; final_meetup_location: string | null }[]>();
    for (const tx of (sellerTransactions || []) as any[]) {
        const txList = sellerTxMap.get(tx.item_id) || [];
        txList.push({ 
            txId: tx.id, 
            buyerId: tx.buyer_id,
            txStatus: tx.status,
            final_meetup_time: tx.final_meetup_time,
            final_meetup_location: tx.final_meetup_location
        });
        sellerTxMap.set(tx.item_id, txList);
    }

    for (const item of (sellerItems || []) as any[]) {
        if (item.status === "sold") {
            continue;
        }

        for (const txInfo of sellerTxMap.get(item.id) || []) {
            if (TERMINAL_TRANSACTION_STATUSES.includes(txInfo.txStatus)) {
                continue;
            }

            active.push({
                id: item.id,
                title: item.title,
                selling_price: item.selling_price,
                status: item.status,
                front_image_url: item.front_image_url || null,
                front_thumbnail_url: item.front_thumbnail_url || null,
                front_image_storage_path: item.front_image_storage_path || null,
                front_thumbnail_storage_path: item.front_thumbnail_storage_path || null,
                image_storage_provider: item.image_storage_provider || null,
                isBuyer: false,
                hasTransaction: true,
                unreadCount: unreadCountMap.get(unreadKey(item.id, txInfo.buyerId)) || 0,
                final_meetup_time: txInfo.final_meetup_time,
                final_meetup_location: txInfo.final_meetup_location,
                transactionId: txInfo.txId,
                counterpartId: txInfo.buyerId,
                transactionStatus: txInfo.txStatus,
            });
        }
    }

    return (
        <TransactionsClient
            initialActiveItems={active}
            initialProfile={profileData as any}
            initialListingCount={cumulativeListingCount}
            initialEarlyRegistrationEligible={resolveEarlyRegistrationEligible(
                session.user.created_at,
                rewardSetting as any,
                rewardOverride as any
            )}
        />
    );
}
