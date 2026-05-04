import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, email, category, categoryLabel, content } = body;

        // バリデーション
        if (!username || !email || !category || !content) {
            return NextResponse.json(
                { success: false, error: '必須項目が入力されていません' },
                { status: 400 }
            );
        }

        if (content.length < 10) {
            return NextResponse.json(
                { success: false, error: 'お問い合わせ内容は10文字以上で入力してください' },
                { status: 400 }
            );
        }

        const gasUrl = process.env.CONTACT_FORM_GAS_URL;
        const supabase = createSupabaseServerClient();

        await (supabase as any).from('inquiries').insert({
            sender_name: username,
            email,
            category,
            content,
            status: 'open',
        });

        if (!gasUrl) {
            console.error('CONTACT_FORM_GAS_URL is not set');
            return NextResponse.json(
                { success: false, error: 'サーバー設定エラー' },
                { status: 500 }
            );
        }

        // Google Apps Script に送信
        const gasResponse = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                category,
                categoryLabel,
                content,
                timestamp: new Date().toISOString(),
            }),
        });

        // GAS は redirect (302) を返すことがあるので、リダイレクト先もフォローする
        if (gasResponse.ok || gasResponse.redirected) {
            return NextResponse.json({ success: true });
        }

        // GAS からのレスポンスを取得
        const gasText = await gasResponse.text().catch(() => 'Unknown error');
        console.error('GAS response error:', gasResponse.status, gasText);

        return NextResponse.json(
            { success: false, error: 'スプレッドシートへの記録に失敗しました' },
            { status: 502 }
        );
    } catch (err: any) {
        console.error('Contact form error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'サーバーエラー' },
            { status: 500 }
        );
    }
}
