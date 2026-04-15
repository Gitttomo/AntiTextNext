import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// POST: 新しい出品に対してウォッチキーワードをチェックし、マッチしたユーザーに通知
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { itemTitle, sellerId } = body;

        if (!itemTitle || !sellerId) {
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

        // 全ユーザーのウォッチキーワードを取得（出品者自身を除く）
        const { data: watchKeywords, error } = await supabase
            .from("watch_keywords")
            .select("user_id, keyword")
            .neq("user_id", sellerId);

        if (error || !watchKeywords) {
            console.error("Watch keywords fetch error:", error);
            return NextResponse.json({ matched: 0 });
        }

        // タイトルに対してキーワードマッチング（部分一致、大文字小文字区別なし）
        const titleLower = itemTitle.toLowerCase();
        const matchedUserIds = new Set<string>();

        for (const wk of watchKeywords) {
            if (titleLower.includes(wk.keyword.toLowerCase())) {
                matchedUserIds.add(wk.user_id);
            }
        }

        // マッチしたユーザーに通知を送信
        if (matchedUserIds.size > 0) {
            const notifications = Array.from(matchedUserIds).map(userId => ({
                user_id: userId,
                type: "watch_match",
                title: "探していた教科書が出品されました！",
                message: `「${itemTitle}」が出品されました。早めにチェックしてみてください！`,
                link_type: "search",
                link_id: itemTitle,
                is_read: false,
            }));

            const { error: notifError } = await (supabase
                .from("notifications") as any)
                .insert(notifications);

            if (notifError) {
                console.error("Notification insert error:", notifError);
            }
        }

        return NextResponse.json({ matched: matchedUserIds.size });
    } catch (err: any) {
        console.error("Check watch keywords error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
