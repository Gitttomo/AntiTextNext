ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS front_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS back_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS front_image_storage_path TEXT,
ADD COLUMN IF NOT EXISTS back_image_storage_path TEXT,
ADD COLUMN IF NOT EXISTS front_thumbnail_storage_path TEXT,
ADD COLUMN IF NOT EXISTS back_thumbnail_storage_path TEXT,
ADD COLUMN IF NOT EXISTS image_storage_provider TEXT NOT NULL DEFAULT 'supabase';

CREATE INDEX IF NOT EXISTS idx_items_image_storage_provider
ON public.items(status, image_storage_provider)
WHERE status = 'available';

COMMENT ON COLUMN public.items.image_storage_provider IS 'Image backend marker. New item images use r2; existing Supabase Storage images remain supabase.';
COMMENT ON COLUMN public.items.front_image_storage_path IS 'Detail-size front image object key/path. For R2 this is a relative key such as items/{itemId}/{uuid}-front-detail.webp.';
COMMENT ON COLUMN public.items.back_image_storage_path IS 'Detail-size back image object key/path. For R2 this is a relative key such as items/{itemId}/{uuid}-back-detail.webp.';
COMMENT ON COLUMN public.items.front_thumbnail_storage_path IS 'Thumbnail front image object key/path. For R2 this is a relative key such as items/{itemId}/{uuid}-front-thumb.webp.';
COMMENT ON COLUMN public.items.back_thumbnail_storage_path IS 'Thumbnail back image object key/path. For R2 this is a relative key such as items/{itemId}/{uuid}-back-thumb.webp.';

NOTIFY pgrst, 'reload schema';
