import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { deleteR2Object } from "@/lib/r2-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const { itemId, paths } = await request.json();
    if (!uuidPattern.test(String(itemId)) || !Array.isArray(paths)) {
      return NextResponse.json({ error: "削除対象が不正です" }, { status: 400 });
    }

    const { data: itemData, error } = await supabase
      .from("items")
      .select("seller_id, image_storage_provider")
      .eq("id", itemId)
      .maybeSingle();
    const item = itemData as { seller_id: string; image_storage_provider?: string | null } | null;

    if (error) throw error;
    if (item && item.seller_id !== session.user.id) {
      return NextResponse.json({ error: "削除権限がありません" }, { status: 403 });
    }

    const safePaths = paths
      .map((path) => String(path || "").trim())
      .filter((path) => path.startsWith(`items/${itemId}/`) && !path.includes(".."));

    const results = await Promise.allSettled(safePaths.map((path) => deleteR2Object(path)));
    const failed = results.filter((result) => result.status === "rejected").length;

    if (failed > 0) {
      console.error(`Failed to delete ${failed} R2 item image object(s)`);
    }

    return NextResponse.json({ success: true, deleted: safePaths.length - failed, failed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "画像削除に失敗しました" }, { status: 500 });
  }
}
