import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// GET: ユーザーのウォッチキーワード一覧取得
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
        .from("watch_keywords")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ keywords: data });
}

// POST: ウォッチキーワードを追加
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { keyword } = body;

    if (!keyword || !keyword.trim()) {
        return NextResponse.json({ error: 'キーワードが空です' }, { status: 400 });
    }

    const trimmed = keyword.trim();

    // 重複チェック
    const { data: existing } = await supabase
        .from("watch_keywords")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("keyword", trimmed)
        .single();

    if (existing) {
        return NextResponse.json({ error: 'このキーワードは既に登録されています' }, { status: 409 });
    }

    // 上限チェック（最大10件）
    const { count } = await supabase
        .from("watch_keywords")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id);

    if ((count || 0) >= 10) {
        return NextResponse.json({ error: '登録できるキーワードは最大10件です' }, { status: 400 });
    }

    const { data, error } = await (supabase
        .from("watch_keywords") as any)
        .insert({
            user_id: session.user.id,
            keyword: trimmed,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, keyword: data });
}

// DELETE: ウォッチキーワードを削除
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: 'IDが指定されていません' }, { status: 400 });
    }

    const { error } = await (supabase
        .from("watch_keywords") as any)
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

// PATCH: ウォッチキーワードを編集
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { id, keyword } = body;

    if (!id || !keyword || !keyword.trim()) {
        return NextResponse.json({ error: 'IDまたはキーワードが不正です' }, { status: 400 });
    }

    const trimmed = keyword.trim();

    // 重複チェック（同じキーワードが別IDで存在しないか）
    const { data: existing } = await supabase
        .from("watch_keywords")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("keyword", trimmed)
        .neq("id", id)
        .single();

    if (existing) {
        return NextResponse.json({ error: 'このキーワードは既に登録されています' }, { status: 409 });
    }

    const { data, error } = await (supabase
        .from("watch_keywords") as any)
        .update({ keyword: trimmed })
        .eq("id", id)
        .eq("user_id", session.user.id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, keyword: data });
}
