import { NextResponse, type NextRequest } from "next/server";
import { adminLog, requireAdmin } from "@/lib/admin-utils";
import { sendAdminNoticeEmail } from "@/lib/email";

const allowedRestrictionTypes = new Set(["warning", "temporary_suspend", "permanent_ban"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, restrictionType, reason, endsAt, adminNote, userNotice } = body;

    if (!userId || !restrictionType || !reason || !String(reason).trim()) {
      return NextResponse.json({ error: "対象ユーザー、制限種別、理由が必要です" }, { status: 400 });
    }

    if (!allowedRestrictionTypes.has(restrictionType)) {
      return NextResponse.json({ error: "指定できない制限種別です" }, { status: 400 });
    }

    const { supabase, user } = await requireAdmin();
    if (user.id === userId && restrictionType === "permanent_ban") {
      return NextResponse.json({ error: "自分自身を永久BANにはできません" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from("user_restrictions")
      .insert({
        user_id: userId,
        restriction_type: restrictionType,
        reason: String(reason).trim(),
        ends_at: restrictionType === "temporary_suspend" ? endsAt || null : null,
        admin_note: adminNote || null,
        user_notice: userNotice || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (userNotice && String(userNotice).trim()) {
      const trimmedNotice = String(userNotice).trim();
      
      await (supabase as any).rpc("admin_send_user_notification", {
        target_user_id: userId,
        notification_title: "アカウント状態について",
        notification_message: trimmedNotice,
        notification_type: "admin_restriction_notice",
        target_link_type: "profile",
        target_link_id: userId,
      });

      // メール送信処理
      try {
        const { data: email } = await (supabase as any).rpc("admin_get_user_email", {
          target_user_id: userId,
          reason: `制限実行(${restrictionType})に伴う通知メール送信のため`,
        });

        if (email) {
          let userLocale = "ja";
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("locale")
            .eq("user_id", userId)
            .single();
          if (profile?.locale) userLocale = profile.locale;

          let emailContent = "";
          if (restrictionType === "warning") {
            emailContent = userLocale === "en" ? `You have received a warning.\nReason: ${trimmedNotice}` : `アカウントに警告が行われました。\n理由: ${trimmedNotice}`;
          } else if (restrictionType === "temporary_suspend") {
            const endsAtStr = endsAt ? new Date(endsAt).toLocaleString(userLocale) : "不明";
            emailContent = userLocale === "en" 
              ? `Your account has been temporarily suspended.\nReason: ${trimmedNotice}\nSuspension ends at: ${endsAtStr}` 
              : `アカウントが一時停止されました。\n理由: ${trimmedNotice}\n停止解除予定: ${endsAtStr}`;
          } else if (restrictionType === "permanent_ban") {
            emailContent = userLocale === "en" ? `Your account has been permanently banned.\nReason: ${trimmedNotice}` : `アカウントが永久停止（BAN）されました。\n理由: ${trimmedNotice}`;
          }

          await sendAdminNoticeEmail(email, "アカウント状態について", emailContent, userLocale);
        }
      } catch (emailErr) {
        console.error("Failed to send restriction email:", emailErr);
      }
    }

    await adminLog(supabase, "user_restriction_created", "user", userId, String(reason).trim(), {
      restrictionId: data?.id,
      restrictionType,
      endsAt: restrictionType === "temporary_suspend" ? endsAt || null : null,
    });

    return NextResponse.json({ success: true, restrictionId: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "制限を登録できませんでした" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reason } = body;

    if (!userId || !reason || !String(reason).trim()) {
      return NextResponse.json({ error: "対象ユーザーと解除理由が必要です" }, { status: 400 });
    }

    const { supabase } = await requireAdmin();
    const { error } = await (supabase as any)
      .from("user_restrictions")
      .update({ lifted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("lifted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await adminLog(supabase, "user_restrictions_lifted", "user", userId, String(reason).trim());

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "制限を解除できませんでした" }, { status: 500 });
  }
}
