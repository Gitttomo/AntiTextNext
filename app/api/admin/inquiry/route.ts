import { NextResponse, type NextRequest } from "next/server";
import { adminLog, requireAdmin } from "@/lib/admin-utils";

const allowedStatuses = new Set(["open", "checking", "replied", "completed", "no_action"]);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { inquiryId, status, adminNote, reason } = body;

    if (!inquiryId || !status) {
      return NextResponse.json({ error: "問い合わせIDと状態が必要です" }, { status: 400 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "指定できない状態です" }, { status: 400 });
    }

    const { supabase, user } = await requireAdmin();
    const { error } = await (supabase as any)
      .from("inquiries")
      .update({
        status,
        admin_note: adminNote ?? null,
        assignee_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminLog(supabase, "inquiry_status_update", "inquiry", inquiryId, reason || `status: ${status}`, {
      status,
      adminNote: adminNote ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "問い合わせを更新できませんでした" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inquiryId, message } = body;

    if (!inquiryId || !message || !String(message).trim()) {
      return NextResponse.json({ error: "問い合わせIDとメッセージが必要です" }, { status: 400 });
    }

    const { supabase, user } = await requireAdmin();
    const { data: inquiry, error: inquiryError } = await (supabase as any)
      .from("inquiries")
      .select("id, sender_user_id, sender_name, status")
      .eq("id", inquiryId)
      .single();

    if (inquiryError || !inquiry) {
      return NextResponse.json({ error: inquiryError?.message || "問い合わせが見つかりません" }, { status: 404 });
    }

    if (!inquiry.sender_user_id) {
      return NextResponse.json({ error: "この問い合わせは送信者ユーザーIDがないため、お知らせへ送信できません" }, { status: 400 });
    }

    const trimmedMessage = String(message).trim();
    const rpcResult = await (supabase as any).rpc("admin_send_user_notification", {
      target_user_id: inquiry.sender_user_id,
      notification_title: "お問い合わせへの返信",
      notification_message: trimmedMessage,
      notification_type: "admin_inquiry_reply",
      target_link_type: null,
      target_link_id: inquiry.id,
    });

    if (rpcResult.error) {
      const { error: insertError } = await (supabase as any).from("notifications").insert({
        user_id: inquiry.sender_user_id,
        type: "admin_inquiry_reply",
        title: "お問い合わせへの返信",
        message: trimmedMessage,
        link_type: null,
        link_id: inquiry.id,
        is_read: false,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    await (supabase as any)
      .from("inquiries")
      .update({
        status: inquiry.status === "completed" ? "completed" : "replied",
        assignee_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiryId);

    await adminLog(supabase, "inquiry_notification_sent", "inquiry", inquiryId, "問い合わせ送信者へお知らせ送信", {
      targetUserId: inquiry.sender_user_id,
      message: trimmedMessage,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "メッセージを送信できませんでした" }, { status: 500 });
  }
}
