import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { INPUT_LIMITS } from "@/lib/input-limits";

export async function POST(request: NextRequest) {
  try {
    const { inquiryId, message } = await request.json();
    const trimmedMessage = String(message || "").trim();

    if (!inquiryId || !trimmedMessage) {
      return NextResponse.json({ error: "問い合わせIDとメッセージが必要です" }, { status: 400 });
    }

    if (trimmedMessage.length > INPUT_LIMITS.contactContentMax) {
      return NextResponse.json(
        { error: `メッセージは${INPUT_LIMITS.contactContentMax}文字以内で入力してください` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { data: inquiry, error: inquiryError } = await (supabase as any)
      .from("inquiries")
      .select("id,status,sender_user_id")
      .eq("id", inquiryId)
      .eq("sender_user_id", user.id)
      .single();

    if (inquiryError || !inquiry) {
      return NextResponse.json({ error: inquiryError?.message || "問い合わせが見つかりません" }, { status: 404 });
    }

    const { error: insertError } = await (supabase as any).from("inquiry_messages").insert({
      inquiry_id: inquiry.id,
      sender_user_id: user.id,
      sender_role: "user",
      message: trimmedMessage,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await (supabase as any)
      .from("inquiries")
      .update({
        status: inquiry.status === "completed" ? "checking" : "checking",
        has_unread_user_message: true,
        last_user_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiry.id)
      .eq("sender_user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "メッセージを送信できませんでした" }, { status: 500 });
  }
}
