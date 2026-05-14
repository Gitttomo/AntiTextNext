CREATE TABLE IF NOT EXISTS public.book_isbn_cache (
  isbn TEXT PRIMARY KEY CHECK (isbn ~ '^97[89][0-9]{10}$'),
  title TEXT NOT NULL,
  original_price INTEGER,
  source TEXT NOT NULL CHECK (source IN ('openbd', 'google_books')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_isbn_cache_updated_at
ON public.book_isbn_cache(updated_at DESC);

ALTER TABLE public.book_isbn_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.book_isbn_cache TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'book_isbn_cache'
      AND policyname = 'Anyone can read book isbn cache'
  ) THEN
    CREATE POLICY "Anyone can read book isbn cache"
    ON public.book_isbn_cache
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'book_isbn_cache'
      AND policyname = 'Anyone can insert book isbn cache'
  ) THEN
    CREATE POLICY "Anyone can insert book isbn cache"
    ON public.book_isbn_cache
    FOR INSERT
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'book_isbn_cache'
      AND policyname = 'Anyone can update book isbn cache'
  ) THEN
    CREATE POLICY "Anyone can update book isbn cache"
    ON public.book_isbn_cache
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
