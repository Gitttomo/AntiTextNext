import { supabase } from "@/lib/supabase";

type ImageVariantOptions = {
  maxLongEdge: number;
  quality: number;
  minQuality: number;
  targetBytes: number;
  suffix: string;
};

type UploadedImageVariant = {
  path: string;
  publicUrl: string;
  size: number;
};

export type UploadedItemImage = {
  detail: UploadedImageVariant;
  thumbnail: UploadedImageVariant;
};

export type ItemImageLike = {
  front_image_url?: string | null;
  back_image_url?: string | null;
  front_thumbnail_url?: string | null;
  back_thumbnail_url?: string | null;
};

const ITEM_DETAIL_VARIANT: ImageVariantOptions = {
  maxLongEdge: 1280,
  quality: 0.78,
  minQuality: 0.58,
  targetBytes: 300 * 1024,
  suffix: "detail",
};

const ITEM_THUMBNAIL_VARIANT: ImageVariantOptions = {
  maxLongEdge: 420,
  quality: 0.72,
  minQuality: 0.52,
  targetBytes: 90 * 1024,
  suffix: "thumb",
};

const CHAT_IMAGE_VARIANT: ImageVariantOptions = {
  maxLongEdge: 1280,
  quality: 0.76,
  minQuality: 0.56,
  targetBytes: 300 * 1024,
  suffix: "chat",
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像の読み込みに失敗しました"));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("画像の圧縮に失敗しました"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export async function compressImageFile(file: File, options: ImageVariantOptions): Promise<Blob> {
  const image = await loadImage(file);
  const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, options.maxLongEdge / longEdge);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("画像処理を開始できませんでした");

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  // Drawing to canvas strips EXIF and other metadata.
  let outputType = "image/webp";
  let quality = options.quality;

  try {
    const testBlob = await canvasToBlob(canvas, outputType, quality);
    if (testBlob.type !== "image/webp") {
      outputType = "image/jpeg";
    } else if (testBlob.size <= options.targetBytes) {
      return testBlob;
    }
  } catch {
    outputType = "image/jpeg";
  }

  let bestBlob: Blob | null = null;
  while (quality >= options.minQuality) {
    const blob = await canvasToBlob(canvas, outputType, quality);
    bestBlob = blob;
    if (blob.size <= options.targetBytes) return blob;
    quality -= 0.06;
  }

  return bestBlob || canvasToBlob(canvas, outputType, options.minQuality);
}

const extensionForBlob = (blob: Blob) => (blob.type === "image/webp" ? "webp" : "jpg");

async function uploadCompressedVariant(
  bucket: string,
  basePath: string,
  file: File,
  options: ImageVariantOptions
): Promise<UploadedImageVariant> {
  const blob = await compressImageFile(file, options);
  const extension = extensionForBlob(blob);
  const path = `${basePath}-${options.suffix}.${extension}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl, size: blob.size };
}

export async function uploadItemImageVariants(file: File, basePath: string): Promise<UploadedItemImage> {
  const [detail, thumbnail] = await Promise.all([
    uploadCompressedVariant("item-images", basePath, file, ITEM_DETAIL_VARIANT),
    uploadCompressedVariant("item-images", basePath, file, ITEM_THUMBNAIL_VARIANT),
  ]);

  return { detail, thumbnail };
}

export async function uploadChatImage(file: File, basePath: string): Promise<string> {
  const uploaded = await uploadCompressedVariant("chat-images", basePath, file, CHAT_IMAGE_VARIANT);
  return uploaded.publicUrl;
}

export function getItemImageUrl(
  item: ItemImageLike,
  side: "front" | "back" = "front",
  variant: "thumbnail" | "detail" = "thumbnail"
) {
  if (side === "back") {
    return variant === "thumbnail"
      ? item.back_thumbnail_url || item.back_image_url || null
      : item.back_image_url || item.back_thumbnail_url || null;
  }

  return variant === "thumbnail"
    ? item.front_thumbnail_url || item.front_image_url || null
    : item.front_image_url || item.front_thumbnail_url || null;
}
