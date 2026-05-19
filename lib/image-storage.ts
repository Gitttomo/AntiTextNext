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
  provider?: "r2" | "supabase";
};

export type ImageUploadFailureStage =
  | "mime_validation"
  | "size_validation"
  | "browser_image_decode"
  | "canvas_context"
  | "canvas_encode"
  | "r2_upload_request"
  | "unknown";

export class ImageProcessingError extends Error {
  stage: ImageUploadFailureStage;
  causeMessage?: string;
  diagnostics?: Record<string, unknown>;

  constructor(
    stage: ImageUploadFailureStage,
    message: string,
    cause?: unknown,
    diagnostics?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ImageProcessingError";
    this.stage = stage;
    this.causeMessage = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : undefined;
    this.diagnostics = diagnostics;
  }
}

export type ItemImageLike = {
  image_storage_provider?: string | null;
  front_image_url?: string | null;
  back_image_url?: string | null;
  front_thumbnail_url?: string | null;
  back_thumbnail_url?: string | null;
  front_image_storage_path?: string | null;
  back_image_storage_path?: string | null;
  front_thumbnail_storage_path?: string | null;
  back_thumbnail_storage_path?: string | null;
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

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const MAX_ORIGINAL_IMAGE_BYTES = 5 * 1024 * 1024;
const BROWSER_DECODE_HELP_MESSAGE = [
  "この画像をブラウザで読み込めませんでした。",
  "Googleフォトから直接選択した画像や、一部の特殊なJPEG/HEIC画像では失敗する場合があります。",
  "スクリーンショットを撮る、JPEG/PNG/WebP形式で保存し直す、または「うまくいかない場合はこちら」より撮影をお試しください。",
].join("\n");
const HEIC_HELP_MESSAGE = [
  "この画像はHEIC/HEIF形式の可能性があります。",
  "現在まだ対応していない形式のため、お手数ですがJPG/PNG/WebP形式で再度アップロードしてください。",
  "（スクリーンショットでうまくあがる可能性があります）",
].join("\n");

const isLikelyHeicFile = (file: File) => {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : "";

  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    mimeType === "image/heic-sequence" ||
    mimeType === "image/heif-sequence" ||
    extension === "heic" ||
    extension === "heif"
  );
};

type DetectedImageFormat = "jpeg" | "png" | "webp" | "heic_heif" | "unknown";

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const asciiFromBytes = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : "."))
    .join("");

async function inspectImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const magicBytes = toHex(bytes.slice(0, 16));
  const ascii = asciiFromBytes(bytes).toLowerCase();
  let detectedFormat: DetectedImageFormat = "unknown";
  let confidence: "high" | "medium" | "low" = "low";

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedFormat = "jpeg";
    confidence = "high";
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    detectedFormat = "png";
    confidence = "high";
  } else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    detectedFormat = "webp";
    confidence = "high";
  } else if (
    ascii.includes("ftypheic") ||
    ascii.includes("ftypheif") ||
    ascii.includes("ftypheix") ||
    ascii.includes("ftyphevc") ||
    ascii.includes("ftyphevx") ||
    ascii.includes("ftypmif1") ||
    ascii.includes("ftypmsf1")
  ) {
    detectedFormat = "heic_heif";
    confidence = "high";
  }

  return {
    magic_bytes: magicBytes,
    detected_format: detectedFormat,
    detected_format_confidence: confidence,
  };
}

export function getImageFailureStage(error: unknown): ImageUploadFailureStage {
  return error instanceof ImageProcessingError ? error.stage : "unknown";
}

export function getImageFailureMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "画像処理中にエラーが発生しました";
}

export function getImageFailureDiagnostics(error: unknown) {
  return error instanceof ImageProcessingError ? error.diagnostics ?? {} : {};
}

export async function getSafeImageFileMetadata(file?: File | null) {
  if (!file) return null;
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.slice(0, 16).toLowerCase() || null
    : null;
  const signature = await inspectImageSignature(file).catch(() => ({
    magic_bytes: null,
    detected_format: "unknown",
    detected_format_confidence: "low",
  }));

  return {
    mime_type: file.type || null,
    extension,
    size_bytes: file.size,
    last_modified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    ...signature,
  };
}

export function assertAllowedImageFile(file: File) {
  if (isLikelyHeicFile(file)) {
    throw new ImageProcessingError("mime_validation", HEIC_HELP_MESSAGE);
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new ImageProcessingError("mime_validation", "アップロードできる画像は JPG / PNG / WebP のみです");
  }

  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new ImageProcessingError("size_validation", "画像サイズは5MB以下にしてください");
  }
}

export async function assertAllowedImageFileSignature(file: File) {
  const signature = await inspectImageSignature(file);
  if (signature.detected_format === "heic_heif") {
    throw new ImageProcessingError("mime_validation", HEIC_HELP_MESSAGE, undefined, signature);
  }
}

type DecodeDiagnostics = {
  object_url_decode_result: "success" | "failed" | "not_tried";
  data_url_decode_result: "success" | "failed" | "not_tried";
  create_image_bitmap_result: "success" | "failed" | "not_supported" | "not_tried";
  decode_method: "object_url" | "data_url" | "create_image_bitmap" | null;
  decoded_width: number | null;
  decoded_height: number | null;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  diagnostics: DecodeDiagnostics;
};

const loadImageElement = (src: string, cleanup?: () => void) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      cleanup?.();
      resolve(image);
    };
    image.onerror = () => {
      cleanup?.();
      reject(new Error("image decode failed"));
    };
    image.src = src;
  });

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("file reader result is not string"));
    };
    reader.onerror = () => reject(reader.error || new Error("file reader failed"));
    reader.readAsDataURL(file);
  });

const loadImage = async (file: File): Promise<LoadedImage> => {
  const diagnostics: DecodeDiagnostics = {
    object_url_decode_result: "not_tried",
    data_url_decode_result: "not_tried",
    create_image_bitmap_result: "not_tried",
    decode_method: null,
    decoded_width: null,
    decoded_height: null,
  };
  const url = URL.createObjectURL(file);
  let lastError: unknown = null;

  try {
    const image = await loadImageElement(url, () => URL.revokeObjectURL(url));
    diagnostics.object_url_decode_result = "success";
    diagnostics.decode_method = "object_url";
    diagnostics.decoded_width = image.naturalWidth;
    diagnostics.decoded_height = image.naturalHeight;
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, diagnostics };
  } catch (blobUrlError) {
    diagnostics.object_url_decode_result = "failed";
    lastError = blobUrlError;
    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await loadImageElement(dataUrl);
      diagnostics.data_url_decode_result = "success";
      diagnostics.decode_method = "data_url";
      diagnostics.decoded_width = image.naturalWidth;
      diagnostics.decoded_height = image.naturalHeight;
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, diagnostics };
    } catch (dataUrlError) {
      diagnostics.data_url_decode_result = "failed";
      lastError = dataUrlError;
    }
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      diagnostics.create_image_bitmap_result = "success";
      diagnostics.decode_method = "create_image_bitmap";
      diagnostics.decoded_width = bitmap.width;
      diagnostics.decoded_height = bitmap.height;
      return { source: bitmap, width: bitmap.width, height: bitmap.height, diagnostics };
    } catch (bitmapError) {
      diagnostics.create_image_bitmap_result = "failed";
      lastError = bitmapError;
    }
  } else {
    diagnostics.create_image_bitmap_result = "not_supported";
  }

  throw new ImageProcessingError(
    "browser_image_decode",
    isLikelyHeicFile(file) ? HEIC_HELP_MESSAGE : BROWSER_DECODE_HELP_MESSAGE,
    lastError,
    diagnostics
  );
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new ImageProcessingError("canvas_encode", "画像の圧縮に失敗しました"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export async function compressImageFile(file: File, options: ImageVariantOptions): Promise<Blob> {
  assertAllowedImageFile(file);
  await assertAllowedImageFileSignature(file);

  const image = await loadImage(file);
  const longEdge = Math.max(image.width, image.height);
  const scale = Math.min(1, options.maxLongEdge / longEdge);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new ImageProcessingError("canvas_context", "画像処理を開始できませんでした", undefined, image.diagnostics);

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image.source, 0, 0, width, height);
  if (typeof ImageBitmap !== "undefined" && image.source instanceof ImageBitmap) {
    image.source.close();
  }

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

export async function uploadItemImageVariantsToR2(
  file: File,
  itemId: string,
  side: "front" | "back"
): Promise<UploadedItemImage> {
  let detailBlob: Blob;
  let thumbnailBlob: Blob;
  try {
    detailBlob = await compressImageFile(file, ITEM_DETAIL_VARIANT);
  } catch (error) {
    throw new ImageProcessingError(
      getImageFailureStage(error),
      getImageFailureMessage(error),
      error,
      { ...getImageFailureDiagnostics(error), variant: "detail" }
    );
  }

  try {
    thumbnailBlob = await compressImageFile(file, ITEM_THUMBNAIL_VARIANT);
  } catch (error) {
    throw new ImageProcessingError(
      getImageFailureStage(error),
      getImageFailureMessage(error),
      error,
      { ...getImageFailureDiagnostics(error), variant: "thumbnail" }
    );
  }
  const formData = new FormData();
  formData.append("itemId", itemId);
  formData.append("side", side);
  formData.append("detail", detailBlob, `${side}-detail.${extensionForBlob(detailBlob)}`);
  formData.append("thumbnail", thumbnailBlob, `${side}-thumb.${extensionForBlob(thumbnailBlob)}`);

  const response = await fetch("/api/item-images/upload", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new ImageProcessingError("r2_upload_request", payload.error || "画像アップロードに失敗しました");
  }

  return {
    provider: "r2",
    detail: payload.detail,
    thumbnail: payload.thumbnail,
  };
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
  const provider = item.image_storage_provider || "supabase";
  if (provider === "r2") {
    const path = side === "back"
      ? variant === "thumbnail"
        ? item.back_thumbnail_storage_path || item.back_image_storage_path
        : item.back_image_storage_path || item.back_thumbnail_storage_path
      : variant === "thumbnail"
        ? item.front_thumbnail_storage_path || item.front_image_storage_path
        : item.front_image_storage_path || item.front_thumbnail_storage_path;

    if (path) return buildPublicItemImageUrl(path);
  }

  if (side === "back") {
    return variant === "thumbnail"
      ? item.back_thumbnail_url || item.back_image_url || null
      : item.back_image_url || item.back_thumbnail_url || null;
  }

  return variant === "thumbnail"
    ? item.front_thumbnail_url || item.front_image_url || null
    : item.front_image_url || item.front_thumbnail_url || null;
}

export function buildPublicItemImageUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;

  const baseUrl = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    "https://img.textnext.jp"
  ).replace(/\/+$/, "");

  return `${baseUrl}/${pathOrUrl.replace(/^\/+/, "")}`;
}
