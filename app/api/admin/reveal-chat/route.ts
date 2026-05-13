import { NextResponse, type NextRequest } from "next/server";
import { adminLog, requireAdmin } from "@/lib/admin-utils";

export async function POST(request: NextRequest) {
  try {
    const { transactionId, reason } = await request.json();
    if (!transactionId || !reason || reason.trim().length < 3) {
      return NextResponse.json({ error: "閲覧理由が必要です" }, { status: 400 });
    }

    const { supabase } = await requireAdmin();
    const { data: transaction, error: txError } = await (supabase as any)
      .from("transactions")
      .select("id, item_id")
      .eq("id", transactionId)
      .single();

    if (txError) throw txError;

    const { data: messages, error } = await (supabase as any)
      .from("messages")
      .select("id, sender_id, receiver_id, message, created_at")
      .eq("item_id", transaction.item_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    await adminLog(supabase, "reveal_transaction_chat", "transaction", transactionId, reason, {
      item_id: transaction.item_id,
      message_count: messages?.length ?? 0,
    });

    return NextResponse.json({ messages: messages ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "チャットを取得できませんでした" }, { status: 500 });
  }
}
