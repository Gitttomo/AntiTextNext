GRANT INSERT ON public.inquiries TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'Authenticated users can submit own inquiries'
  ) THEN
    CREATE POLICY "Authenticated users can submit own inquiries"
    ON public.inquiries
    FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND sender_user_id = auth.uid()
      AND status = 'open'
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
