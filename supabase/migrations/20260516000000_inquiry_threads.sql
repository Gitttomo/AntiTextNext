CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_user_id UUID,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_created
ON public.inquiry_messages(inquiry_id, created_at);

ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.inquiry_messages TO authenticated;
GRANT SELECT ON public.inquiries TO authenticated;
GRANT UPDATE (status, updated_at) ON public.inquiries TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'Users can read own inquiries'
  ) THEN
    CREATE POLICY "Users can read own inquiries"
    ON public.inquiries
    FOR SELECT
    USING (sender_user_id = auth.uid() OR public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiries'
      AND policyname = 'Users can mark own inquiries active'
  ) THEN
    CREATE POLICY "Users can mark own inquiries active"
    ON public.inquiries
    FOR UPDATE
    USING (sender_user_id = auth.uid() OR public.is_current_user_admin())
    WITH CHECK (sender_user_id = auth.uid() OR public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'Users and admins can read inquiry messages'
  ) THEN
    CREATE POLICY "Users and admins can read inquiry messages"
    ON public.inquiry_messages
    FOR SELECT
    USING (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1
        FROM public.inquiries i
        WHERE i.id = inquiry_id
          AND i.sender_user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'Users can add own inquiry messages'
  ) THEN
    CREATE POLICY "Users can add own inquiry messages"
    ON public.inquiry_messages
    FOR INSERT
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND sender_role = 'user'
      AND sender_user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.inquiries i
        WHERE i.id = inquiry_id
          AND i.sender_user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inquiry_messages'
      AND policyname = 'Admins can add inquiry messages'
  ) THEN
    CREATE POLICY "Admins can add inquiry messages"
    ON public.inquiry_messages
    FOR INSERT
    WITH CHECK (
      public.is_current_user_admin()
      AND sender_role = 'admin'
      AND sender_user_id = auth.uid()
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
