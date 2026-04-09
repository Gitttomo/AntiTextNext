import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'ユーザーIDが指定されていません' },
                { status: 400 }
            );
        }

        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: any) {
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: any) {
                        cookieStore.set({ name, value: '', ...options });
                    },
                },
            }
        );

        // 認証ユーザーとリクエストのuserIdが一致するか確認
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || session.user.id !== userId) {
            return NextResponse.json(
                { success: false, error: '認証エラー' },
                { status: 401 }
            );
        }

        // 進行中の取引がないか最終確認
        const { data: activeTx } = await (supabase
            .from("transactions") as any)
            .select("id")
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .in("status", ["pending", "awaiting_rating", "transaction_pending"]);

        if (activeTx && activeTx.length > 0) {
            return NextResponse.json(
                { success: false, error: '進行中の取引があるため、アカウントを停止できません' },
                { status: 400 }
            );
        }

        // 1. プロフィールを停止状態に更新
        const { error: profileError } = await (supabase
            .from("profiles") as any)
            .update({
                is_deactivated: true,
                deactivated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

        if (profileError) {
            console.error("Profile deactivation error:", profileError);
            return NextResponse.json(
                { success: false, error: 'プロフィールの更新に失敗しました' },
                { status: 500 }
            );
        }

        // 2. 出品中の商品を非公開にする (status → deactivated)
        const { error: itemsError } = await (supabase
            .from("items") as any)
            .update({ status: "deactivated" })
            .eq("seller_id", userId)
            .eq("status", "available");

        if (itemsError) {
            console.error("Items deactivation error:", itemsError);
            // アイテム更新に失敗してもアカウント停止は続行
        }

        // 3. サインアウト
        await supabase.auth.signOut();

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Deactivate account error:", err);
        return NextResponse.json(
            { success: false, error: err.message || 'サーバーエラー' },
            { status: 500 }
        );
    }
}
