import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// POST: 新しい出品に対してウォッチキーワードをチェックし、マッチしたユーザーに通知
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { itemId } = body;

        if (!itemId) {
            return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 });
        }

        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                    set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
                    remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }); },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            return NextResponse.json({ error: '未認証' }, { status: 401 });
        }

        const { data, error } = await (supabase as any).rpc("notify_watch_keyword_matches", {
            target_item_id: itemId,
        });

        if (error) {
            console.error("Watch keyword notification error:", error);
            return NextResponse.json({ matched: 0 });
        }

        return NextResponse.json({ matched: data ?? 0 });
    } catch (err: any) {
        console.error("Check watch keywords error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
