import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const token_hash = requestUrl.searchParams.get('token_hash');
    const type = requestUrl.searchParams.get('type');

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

    // フロー1: PKCE（コード交換）フロー
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // メール認証成功 → プロフィール初期設定ページへ
            return NextResponse.redirect(new URL('/auth/setup-profile', requestUrl.origin));
        }
    }

    // フロー2: トークンハッシュフロー（確認メールが直接token_hashを渡すケース）
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
        });

        if (!error) {
            // メール認証成功 → プロフィール初期設定ページへ
            return NextResponse.redirect(new URL('/auth/setup-profile', requestUrl.origin));
        }
    }

    // エラー時はログインページへ
    return NextResponse.redirect(new URL('/auth/login?error=auth_callback_failed', requestUrl.origin));
}
