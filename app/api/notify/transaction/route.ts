import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { sendTransactionProgressEmail, sendNewMessageEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, itemId, receiverId, extraData } = body;
        
        // action: 'request', 'approve', 'decline', 'message'
        if (!action || !itemId || !receiverId) {
            return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
        }

        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                    set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
                    remove(name: string, options: any) { cookieStore.set({ name, value: "", ...options }); },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: "未認証" }, { status: 401 });
        }

        // 受信者の通知設定を取得
        const { data: profile } = await supabase
            .from("profiles")
            .select("email_notify_transaction_progress, email_notify_chat_messages, locale")
            .eq("user_id", receiverId)
            .single();

        if (!profile) return NextResponse.json({ success: true, skipped: true });

        // 設定の確認
        const isTransactionAction = ["request", "approve", "decline", "rating_remind"].includes(action);
        if (isTransactionAction && !profile.email_notify_transaction_progress) {
            return NextResponse.json({ success: true, skipped: true });
        }
        if (action === "message" && !profile.email_notify_chat_messages) {
            return NextResponse.json({ success: true, skipped: true });
        }

        // 商品情報の取得
        const { data: item } = await supabase
            .from("items")
            .select("title")
            .eq("id", itemId)
            .single();

        const itemTitle = item?.title || "商品";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const actionUrl = `${baseUrl}/chat/${itemId}`;

        // メールの取得
        const { data: email } = await (supabase as any).rpc("admin_get_user_email", {
            target_user_id: receiverId,
            reason: `自動メール通知 (${action})`,
        });

        if (!email) return NextResponse.json({ success: true, skipped: true });

        const locale = profile.locale || "ja";

        if (action === "request") {
            const title = locale === "en" ? "Purchase Request Received" : "購入リクエストを受信しました";
            const content = locale === "en" 
                ? `You have received a purchase request for your item "${itemTitle}". Please review it in the chat.` 
                : `出品した商品「${itemTitle}」に購入リクエストが届きました。チャットから内容を確認して、承認または辞退を行ってください。`;
            await sendTransactionProgressEmail(email, title, content, actionUrl, locale);
        } else if (action === "approve") {
            const title = locale === "en" ? "Purchase Request Approved" : "購入リクエストが承認されました";
            const content = locale === "en" 
                ? `Your purchase request for "${itemTitle}" has been approved! The transaction has started.` 
                : `商品「${itemTitle}」の購入リクエストが承認されました！取引が開始されました。チャットで引き続き連絡を取り合ってください。`;
            await sendTransactionProgressEmail(email, title, content, actionUrl, locale);
        } else if (action === "decline") {
            const title = locale === "en" ? "Purchase Request Declined" : "購入リクエストが見送られました";
            const content = locale === "en" 
                ? `Unfortunately, your purchase request for "${itemTitle}" was declined by the seller.` 
                : `残念ながら、商品「${itemTitle}」の購入リクエストは見送られました。`;
            await sendTransactionProgressEmail(email, title, content, actionUrl, locale);
        } else if (action === "message") {
            const senderName = extraData?.senderName || "ユーザー";
            await sendNewMessageEmail(email, senderName, actionUrl, locale);
        } else if (action === "rating_remind") {
            const title = locale === "en" ? "Please Rate Your Transaction" : "取引相手からの評価が完了しました";
            const content = locale === "en" 
                ? `The other party has submitted their rating for "${itemTitle}". Please submit your rating to complete the transaction.` 
                : `取引相手が商品「${itemTitle}」の評価を完了しました。あなたも評価を完了させて、取引を終了させてください。`;
            const ratingUrl = `${baseUrl}/rating/${extraData?.transactionId}`;
            await sendTransactionProgressEmail(email, title, content, ratingUrl, locale);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Notify error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
