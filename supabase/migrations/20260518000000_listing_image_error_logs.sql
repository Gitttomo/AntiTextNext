CREATE TABLE IF NOT EXISTS public.listing_image_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id UUID,
  stage TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'unknown' CHECK (side IN ('front', 'back', 'unknown')),
  message TEXT NOT NULL,
  mime_type TEXT,
  extension TEXT,
  size_bytes BIGINT,
  last_modified TIMESTAMPTZ,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_image_error_logs_user_created
ON public.listing_image_error_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listing_image_error_logs_stage_created
ON public.listing_image_error_logs(stage, created_at DESC);

ALTER TABLE public.listing_image_error_logs ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.listing_image_error_logs TO authenticated;
GRANT SELECT ON public.listing_image_error_logs TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listing_image_error_logs'
      AND policyname = 'Users can insert own listing image errors'
  ) THEN
    CREATE POLICY "Users can insert own listing image errors"
    ON public.listing_image_error_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listing_image_error_logs'
      AND policyname = 'Admins can read listing image errors'
  ) THEN
    CREATE POLICY "Admins can read listing image errors"
    ON public.listing_image_error_logs
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
