ALTER TABLE public.listing_image_error_logs
ADD COLUMN IF NOT EXISTS detected_format TEXT,
ADD COLUMN IF NOT EXISTS magic_bytes TEXT,
ADD COLUMN IF NOT EXISTS decode_method TEXT,
ADD COLUMN IF NOT EXISTS decoded_width INTEGER,
ADD COLUMN IF NOT EXISTS decoded_height INTEGER,
ADD COLUMN IF NOT EXISTS object_url_decode_result TEXT,
ADD COLUMN IF NOT EXISTS data_url_decode_result TEXT,
ADD COLUMN IF NOT EXISTS create_image_bitmap_result TEXT;

CREATE INDEX IF NOT EXISTS idx_listing_image_error_logs_detected_format
ON public.listing_image_error_logs(detected_format, created_at DESC);

COMMENT ON COLUMN public.listing_image_error_logs.magic_bytes IS 'Short hex string of the first bytes only. Does not contain image body or filename.';
COMMENT ON COLUMN public.listing_image_error_logs.detected_format IS 'Best-effort format detected from file signature: jpeg/png/webp/heic_heif/unknown.';
COMMENT ON COLUMN public.listing_image_error_logs.decode_method IS 'Successful browser decode path if known: object_url/data_url/create_image_bitmap.';

NOTIFY pgrst, 'reload schema';
