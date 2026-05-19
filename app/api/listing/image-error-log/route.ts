import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const allowedStages = new Set([
  "mime_validation",
  "size_validation",
  "browser_image_decode",
  "canvas_context",
  "canvas_encode",
  "r2_upload_request",
  "unknown",
]);

const allowedSides = new Set(["front", "back", "unknown"]);

const trimText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const safeInteger = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
};

const safeDecodeResult = (value: unknown) => {
  const result = trimText(value, 40);
  return result && /^[a-z_]+$/.test(result) ? result : null;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    const body = await request.json();
    const file = body?.file && typeof body.file === "object" ? body.file : {};
    const stage = allowedStages.has(body?.stage) ? body.stage : "unknown";
    const side = allowedSides.has(body?.side) ? body.side : "unknown";
    const itemId = trimText(body?.itemId, 80);
    const message = trimText(body?.message, 500) || "画像処理中にエラーが発生しました";
    const extension = trimText(file.extension, 16);
    const mimeType = trimText(file.mime_type, 80);
    const lastModified = trimText(file.last_modified, 80);
    const magicBytes = trimText(file.magic_bytes, 64);
    const detectedFormat = trimText(file.detected_format, 40);
    const userAgent = trimText(request.headers.get("user-agent"), 500);
    const sizeBytes = safeInteger(file.size_bytes);
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const { error } = await (supabase.from("listing_image_error_logs") as any).insert({
      user_id: session.user.id,
      item_id: itemId || null,
      stage,
      side,
      message,
      mime_type: mimeType,
      extension,
      size_bytes: sizeBytes,
      last_modified: lastModified,
      magic_bytes: magicBytes,
      detected_format: detectedFormat,
      decode_method: safeDecodeResult(metadata.decode_method),
      decoded_width: safeInteger(metadata.decoded_width),
      decoded_height: safeInteger(metadata.decoded_height),
      object_url_decode_result: safeDecodeResult(metadata.object_url_decode_result),
      data_url_decode_result: safeDecodeResult(metadata.data_url_decode_result),
      create_image_bitmap_result: safeDecodeResult(metadata.create_image_bitmap_result),
      user_agent: userAgent,
      metadata: {
        source: "listing_page",
        title_length: safeInteger(metadata.title_length),
        has_description: Boolean(metadata.has_description),
        detected_format_confidence: trimText(file.detected_format_confidence, 20),
        variant: trimText(metadata.variant, 40),
      },
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("listing image error log failed", error);
    return NextResponse.json({ error: "ログ記録に失敗しました" }, { status: 500 });
  }
}
