import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TransactionsClient from "./transactions-client";

export const dynamic = "force-dynamic";

type TransactionItem = {
    id: string;
    title: string;
    selling_price: number;
    status: string;
    front_image_url: string | null;
    isBuyer: boolean;
    hasTransaction: boolean;
    unreadCount: number;
};

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
                initialHistoryItems={[]}
                initialProfile={null}
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
        { data: unreadMessages }
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
                items(id, title, selling_price, status, front_image_url)
            `)
            .eq("buyer_id", userId),
        supabase
            .from("items")
            .select("id, title, selling_price, status, seller_id, front_image_url")
            .eq("seller_id", userId),
        supabase
            .from("transactions")
            .select("id, item_id, status")
            .eq("seller_id", userId),
        supabase
            .from("messages")
            .select("item_id")
            .eq("receiver_id", userId)
            .eq("is_read", false)
    ]);

    // Data processing (mirrored from client logic for consistency)
    const unreadCountMap = new Map<string, number>();
    if (unreadMessages) {
        for (const msg of unreadMessages as any[]) {
            const count = unreadCountMap.get(msg.item_id) || 0;
            unreadCountMap.set(msg.item_id, count + 1);
        }
    }

    const active: TransactionItem[] = [];
    const history: TransactionItem[] = [];

    // Process Buyer Transactions
    for (const tx of (buyerTransactions || []) as any[]) {
        const item = tx.items;
        if (!item) continue;

        const txItem: TransactionItem = {
            id: item.id,
            title: item.title,
            selling_price: item.selling_price,
            status: item.status,
            front_image_url: item.front_image_url || null,
            isBuyer: true,
            hasTransaction: true,
            unreadCount: unreadCountMap.get(item.id) || 0,
        };

        if (tx.status === "completed" || item.status === "sold") {
            history.push(txItem);
        } else {
            active.push(txItem);
        }
    }

    // Process Seller Items & Transactions
    const sellerTxMap = new Map<string, { txId: string; txStatus: string }>();
    for (const tx of (sellerTransactions || []) as any[]) {
        sellerTxMap.set(tx.item_id, { txId: tx.id, txStatus: tx.status });
    }

    for (const item of (sellerItems || []) as any[]) {
        const txInfo = sellerTxMap.get(item.id);
        const txItem: TransactionItem = {
            id: item.id,
            title: item.title,
            selling_price: item.selling_price,
            status: item.status,
            front_image_url: item.front_image_url || null,
            isBuyer: false,
            hasTransaction: !!txInfo,
            unreadCount: unreadCountMap.get(item.id) || 0,
        };

        if (item.status === "sold" || txInfo?.txStatus === "completed") {
            history.push(txItem);
        } else if (item.status === "transaction_pending" || txInfo) {
            active.push(txItem);
        }
    }

    return (
        <TransactionsClient
            initialActiveItems={active}
            initialHistoryItems={history}
            initialProfile={profileData as any}
        />
    );
}
