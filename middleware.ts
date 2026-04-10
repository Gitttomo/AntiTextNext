import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;

  // 除外パス（これらのページはリダイレクトしない）
  const excludedPaths = [
    '/auth/login',
    '/auth/signup',
    '/auth/callback',
    '/auth/setup-profile',
    '/auth/add-to-home',
    '/auth/reactivate',
    '/api/',
    '/contact',
    '/settings',
  ];

  const isExcluded = excludedPaths.some(path => pathname.startsWith(path));

  // セッションがあり、除外パスでない場合 → プロフィールが存在するか確認
  if (session?.user && !isExcluded) {
    try {
      const { data: profile, error } = await (supabase
        .from("profiles") as any)
        .select("user_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile && !error) {
        // プロフィール未設定 → 設定ページにリダイレクト
        return NextResponse.redirect(new URL('/auth/setup-profile', request.url));
      }
      // エラー時はリダイレクトせずそのまま通す（無限ループ防止）
    } catch {
      // クエリエラー時もそのまま通す
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons (PWA icons)
     * - manifest.json
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json).*)',
  ],
};
