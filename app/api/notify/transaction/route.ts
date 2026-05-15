import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { sendTransactionProgressEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, itemId, receiverId, extraData } = body;

        // action: 'request', 'approve', 'decline', 'message'
        if (!action || !itemId || !receiverId) {
            return NextResponse.json({ error: "パラメータ不足" }, { status: 400 });
        }

        // 通常チャット1通ごとのメール通知は送らない。
        // アプリ内通知・未読表示を優先し、メールは取引進行上重要なイベントに限定する。
        if (action === "message") {
            return NextResponse.json({ success: true, skipped: true, reason: "message_email_disabled" });
        }

        const cookieStore = cookies();

        // 認証チェック用クライアント（通常のanonキー）
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
            .select("email_notify_transaction_progress, locale")
            .eq("user_id", receiverId)
            .single();

        if (!profile) return NextResponse.json({ success: true, skipped: true });

        // 設定の確認
        const isTransactionAction = ["request", "approve", "decline", "rating_remind"].includes(action);
        if (isTransactionAction && !profile.email_notify_transaction_progress) {
            return NextResponse.json({ success: true, skipped: true });
        }

        // 商品情報の取得
        const { data: item } = await supabase
            .from("items")
            .select("title")
            .eq("id", itemId)
            .single();

        const itemTitle = item?.title || "商品";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://textnext.jp";
        const actionUrl = extraData?.transactionId
            ? `${baseUrl}/chat/${itemId}?tx=${extraData.transactionId}`
            : `${baseUrl}/chat/${itemId}`;

        // ===== メールアドレス取得 =====
        // Service Role キーを使ってサーバーサイドでメールアドレスを安全に取得
        // （admin_get_user_email RPCは管理者専用のため使用不可）
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Cannot send email notification.");
            return NextResponse.json({ success: true, skipped: true });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: { user: targetUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(receiverId);

        if (userError || !targetUser?.email) {
            console.warn("Failed to get receiver email:", userError?.message);
            return NextResponse.json({ success: true, skipped: true });
        }

        const email = targetUser.email;
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
