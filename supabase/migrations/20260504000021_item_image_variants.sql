ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS front_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS back_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS front_image_storage_path TEXT,
ADD COLUMN IF NOT EXISTS back_image_storage_path TEXT,
ADD COLUMN IF NOT EXISTS front_thumbnail_storage_path TEXT,
ADD COLUMN IF NOT EXISTS back_thumbnail_storage_path TEXT,
ADD COLUMN IF NOT EXISTS image_storage_provider TEXT NOT NULL DEFAULT 'supabase';

CREATE INDEX IF NOT EXISTS idx_items_image_cleanup
ON public.items(status, image_storage_provider)
WHERE status IN ('sold', 'deleted', 'deactivated');

COMMENT ON COLUMN public.items.front_image_url IS 'Detail-size front cover URL. Existing rows may still contain original full-size URLs.';
COMMENT ON COLUMN public.items.back_image_url IS 'Detail-size back cover URL. Existing rows may still contain original full-size URLs.';
COMMENT ON COLUMN public.items.front_thumbnail_url IS 'List/search thumbnail-size front cover URL. Falls back to front_image_url when null.';
COMMENT ON COLUMN public.items.back_thumbnail_url IS 'List/search thumbnail-size back cover URL. Falls back to back_image_url when null.';
COMMENT ON COLUMN public.items.image_storage_provider IS 'Image storage backend marker. Current default is supabase; allows future R2 migration per item.';

NOTIFY pgrst, 'reload schema';
