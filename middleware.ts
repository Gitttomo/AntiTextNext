import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';
import { isCurrentUserAdmin } from '@/lib/admin';

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
  const isAdminRoute = pathname.startsWith('/admin');

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

  if (isAdminRoute) {
    if (!session?.user) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const isAdmin = await isCurrentUserAdmin(supabase as any);

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/profile', request.url));
    }
  }

  // セッションがあり、除外パスでない場合の処理（制限チェックやプロフィール未設定チェック）は
  // パフォーマンスのためクライアントの auth-provider.tsx で非同期に行います。
  
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
