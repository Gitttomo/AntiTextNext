import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');
    const excludeUserId = searchParams.get('excludeUserId'); // プロフィール編集時に自分を除外

    if (!nickname || nickname.trim().length === 0) {
        return NextResponse.json({ available: false, error: 'ユーザーネームを入力してください' });
    }

    // バリデーション: 日本語、英数字、アンダースコアのみ (2-20文字)
    const usernameRegex = /^[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]{2,20}$/;
    if (!usernameRegex.test(nickname)) {
        return NextResponse.json({
            available: false,
            error: '2〜20文字の日本語・英数字・アンダースコアのみ使用可能です'
        });
    }

    try {
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        let query = (supabase.from("profiles") as any)
            .select("user_id")
            .eq("nickname", nickname.trim());

        // プロフィール編集時は自分のuser_idを除外
        if (excludeUserId) {
            query = query.neq("user_id", excludeUserId);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Username check error:", error);
            return NextResponse.json({ available: false, error: '確認中にエラーが発生しました' });
        }

        const available = !data || data.length === 0;
        return NextResponse.json({
            available,
            error: available ? null : 'このユーザーネームは既に使用されています'
        });
    } catch (err) {
        console.error("Username check exception:", err);
        return NextResponse.json({ available: false, error: 'サーバーエラーが発生しました' });
    }
}
