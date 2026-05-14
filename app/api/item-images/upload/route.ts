import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildR2PublicUrl, uploadR2Object } from "@/lib/r2-server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxDetailBytes = 2 * 1024 * 1024;
const maxThumbnailBytes = 700 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const extensionForContentType = (contentType: string) => {
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/png") return "png";
  return "jpg";
};

const readImageFile = async (formData: FormData, name: string, maxBytes: number) => {
  const value = formData.get(name);
  if (!(value instanceof File)) {
    throw new Error(`${name} is required`);
  }

  if (!allowedTypes.has(value.type)) {
    throw new Error("対応していない画像形式です");
  }

  if (value.size <= 0 || value.size > maxBytes) {
    throw new Error("画像サイズが大きすぎます");
  }

  return value;
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

    const formData = await request.formData();
    const itemId = String(formData.get("itemId") || "");
    const side = String(formData.get("side") || "");

    if (!uuidPattern.test(itemId)) {
      return NextResponse.json({ error: "itemIdが不正です" }, { status: 400 });
    }

    if (side !== "front" && side !== "back") {
      return NextResponse.json({ error: "画像種別が不正です" }, { status: 400 });
    }

    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("seller_id")
      .eq("id", itemId)
      .maybeSingle();
    const item = itemData as { seller_id: string } | null;

    if (itemError) throw itemError;
    if (!item || item.seller_id !== session.user.id) {
      return NextResponse.json({ error: "画像をアップロードする権限がありません" }, { status: 403 });
    }

    const detailFile = await readImageFile(formData, "detail", maxDetailBytes);
    const thumbnailFile = await readImageFile(formData, "thumbnail", maxThumbnailBytes);
    const objectId = crypto.randomUUID();
    const detailPath = `items/${itemId}/${objectId}-${side}-detail.${extensionForContentType(detailFile.type)}`;
    const thumbnailPath = `items/${itemId}/${objectId}-${side}-thumb.${extensionForContentType(thumbnailFile.type)}`;

    const [detailBuffer, thumbnailBuffer] = await Promise.all([
      Buffer.from(await detailFile.arrayBuffer()),
      Buffer.from(await thumbnailFile.arrayBuffer()),
    ]);

    await Promise.all([
      uploadR2Object({ key: detailPath, body: detailBuffer, contentType: detailFile.type }),
      uploadR2Object({ key: thumbnailPath, body: thumbnailBuffer, contentType: thumbnailFile.type }),
    ]);

    return NextResponse.json({
      provider: "r2",
      detail: {
        path: detailPath,
        publicUrl: buildR2PublicUrl(detailPath),
        size: detailFile.size,
      },
      thumbnail: {
        path: thumbnailPath,
        publicUrl: buildR2PublicUrl(thumbnailPath),
        size: thumbnailFile.size,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "画像アップロードに失敗しました" }, { status: 500 });
  }
}
