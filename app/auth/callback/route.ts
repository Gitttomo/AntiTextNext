import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const token_hash = requestUrl.searchParams.get('token_hash');
    const type = requestUrl.searchParams.get('type');
    const next = requestUrl.searchParams.get('next');
    const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : null;
    const successPath = safeNext || (type === 'recovery' ? '/auth/update-password' : '/auth/setup-profile');

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
            return NextResponse.redirect(new URL(successPath, requestUrl.origin));
        }
    }

    // フロー2: トークンハッシュフロー（確認メールが直接token_hashを渡すケース）
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
        });

        if (!error) {
            return NextResponse.redirect(new URL(successPath, requestUrl.origin));
        }
    }

    // エラー時はログインページへ逃がさず、リンクの期限切れ/使用済みを明示する
    const errorUrl = new URL('/auth/link-error', requestUrl.origin);
    errorUrl.searchParams.set('type', type || 'auth');
    return NextResponse.redirect(errorUrl);
}
