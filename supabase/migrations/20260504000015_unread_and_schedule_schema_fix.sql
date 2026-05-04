ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS schedule_change_requested_by UUID,
ADD COLUMN IF NOT EXISTS previous_final_meetup_time TEXT,
ADD COLUMN IF NOT EXISTS previous_final_meetup_location TEXT;

GRANT UPDATE (is_read) ON public.messages TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can mark received messages as read'
  ) THEN
    CREATE POLICY "Users can mark received messages as read"
    ON public.messages
    FOR UPDATE
    USING (receiver_id = auth.uid())
    WITH CHECK (receiver_id = auth.uid());
  END IF;
END $$;

GRANT UPDATE (is_read) ON public.notifications TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can mark own notifications as read'
  ) THEN
    CREATE POLICY "Users can mark own notifications as read"
    ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
