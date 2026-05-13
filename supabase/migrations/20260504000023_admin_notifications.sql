CREATE OR REPLACE FUNCTION public.admin_send_user_notification(
  target_user_id UUID,
  notification_title TEXT,
  notification_message TEXT,
  notification_type TEXT DEFAULT 'admin_message',
  target_link_type TEXT DEFAULT NULL,
  target_link_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target user is required';
  END IF;

  IF notification_message IS NULL OR LENGTH(TRIM(notification_message)) < 1 THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  VALUES (
    target_user_id,
    COALESCE(NULLIF(notification_type, ''), 'admin_message'),
    COALESCE(NULLIF(notification_title, ''), '運営からのお知らせ'),
    notification_message,
    target_link_type,
    target_link_id,
    false
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_user_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
