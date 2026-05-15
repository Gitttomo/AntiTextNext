import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { adminLog, requireAdmin } from "@/lib/admin-utils";

const allowedStatuses = new Set(["available", "paused", "deleted"]);
const allowedReasonCodes = new Set([
  "test_data",
  "prohibited_item",
  "inappropriate_price",
  "duplicate",
  "reported_item",
  "user_request",
  "suspicious",
  "other",
]);

export async function POST(request: NextRequest) {
  try {
    const { itemId, status, reasonCode, note } = await request.json();
    const trimmedNote = String(note || "").trim();
    const normalizedReasonCode = allowedReasonCodes.has(reasonCode) ? reasonCode : "other";

    if (!itemId || !allowedStatuses.has(status) || !trimmedNote) {
      return NextResponse.json({ error: "出品ID、変更先ステータス、管理者メモが必要です" }, { status: 400 });
    }

    const { supabase } = await requireAdmin();
    const { data: item, error: itemError } = await (supabase as any)
      .from("items")
      .select("id,title,status,seller_id,image_storage_provider")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) {
      return NextResponse.json({ error: "出品が見つかりません" }, { status: 404 });
    }

    const { error } = await (supabase as any).rpc("admin_update_item_status", {
      target_item_id: itemId,
      new_status: status,
      note: `[${normalizedReasonCode}] ${trimmedNote}`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    revalidatePath("/");
    revalidatePath("/search");
    revalidatePath(`/product/${itemId}`);
    revalidatePath(`/seller/${item.seller_id}`);
    revalidatePath("/admin/items");
    revalidatePath(`/admin/items/${itemId}`);

    await adminLog(
      supabase,
      status === "deleted" ? "item_admin_hidden" : status === "paused" ? "item_paused" : "item_available",
      "item",
      itemId,
      `[${normalizedReasonCode}] ${trimmedNote}`,
      {
        reasonCode: normalizedReasonCode,
        note: trimmedNote,
        previousStatus: item.status,
        newStatus: status,
        title: item.title,
        sellerId: item.seller_id,
        r2DeletionAttempted: false,
        r2DeleteFailed: 0,
      }
    );

    return NextResponse.json({ success: true, r2DeletionAttempted: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "出品ステータスを変更できませんでした" }, { status: 500 });
  }
}
