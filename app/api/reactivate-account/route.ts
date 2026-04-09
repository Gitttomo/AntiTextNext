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

        // 1. プロフィールを復旧
        const { error: profileError } = await (supabase
            .from("profiles") as any)
            .update({
                is_deactivated: false,
                deactivated_at: null,
            })
            .eq("user_id", userId);

        if (profileError) {
            console.error("Profile reactivation error:", profileError);
            return NextResponse.json(
                { success: false, error: 'プロフィールの更新に失敗しました' },
                { status: 500 }
            );
        }

        // 2. 停止されていた商品を再公開 (status: deactivated → available)
        const { error: itemsError } = await (supabase
            .from("items") as any)
            .update({ status: "available" })
            .eq("seller_id", userId)
            .eq("status", "deactivated");

        if (itemsError) {
            console.error("Items reactivation error:", itemsError);
            // アイテム復旧に失敗しても復旧は続行
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Reactivate account error:", err);
        return NextResponse.json(
            { success: false, error: err.message || 'サーバーエラー' },
            { status: 500 }
        );
    }
}
