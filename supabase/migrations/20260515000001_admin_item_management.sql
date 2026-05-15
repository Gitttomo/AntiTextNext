ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible',
ADD COLUMN IF NOT EXISTS moderation_note TEXT,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_target
ON public.admin_action_logs(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_admin_status
ON public.items(status, moderation_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_update_item_status(
  target_item_id UUID,
  new_status TEXT,
  note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  IF new_status NOT IN ('available', 'paused', 'deleted') THEN
    RAISE EXCEPTION 'unsupported item status: %', new_status;
  END IF;

  UPDATE public.items
  SET
    status = new_status,
    moderation_status = CASE
      WHEN new_status = 'available' THEN 'visible'
      WHEN new_status = 'paused' THEN 'hidden'
      WHEN new_status = 'deleted' THEN 'deleted'
      ELSE moderation_status
    END,
    moderation_note = COALESCE(NULLIF(TRIM(note), ''), moderation_note),
    hidden_at = CASE
      WHEN new_status = 'paused' THEN NOW()
      WHEN new_status = 'available' THEN NULL
      ELSE hidden_at
    END,
    deleted_at = CASE
      WHEN new_status = 'deleted' THEN NOW()
      ELSE deleted_at
    END
  WHERE id = target_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_item_status(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_purge_item(
  target_item_id UUID,
  reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
  transaction_count INTEGER := 0;
  deleted_favorites INTEGER := 0;
  deleted_messages INTEGER := 0;
  deleted_notifications INTEGER := 0;
  deleted_lock_attempts INTEGER := 0;
  deleted_request_history INTEGER := 0;
  deleted_reports INTEGER := 0;
  deleted_flags INTEGER := 0;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  IF reason IS NULL OR LENGTH(TRIM(reason)) < 5 THEN
    RAISE EXCEPTION 'purge reason is required';
  END IF;

  SELECT id, title, seller_id, status
  INTO item_record
  FROM public.items
  WHERE id = target_item_id
  FOR UPDATE;

  IF item_record.id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  SELECT COUNT(*)
  INTO transaction_count
  FROM public.transactions
  WHERE item_id = target_item_id;

  IF transaction_count > 0 THEN
    RAISE EXCEPTION 'cannot purge item with transactions';
  END IF;

  DELETE FROM public.favorites WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_favorites = ROW_COUNT;

  DELETE FROM public.messages WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_messages = ROW_COUNT;

  DELETE FROM public.notifications
  WHERE link_id = target_item_id::TEXT
    AND COALESCE(link_type, '') IN ('chat', 'transaction', 'item', 'product');
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  DELETE FROM public.purchase_lock_attempts WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_lock_attempts = ROW_COUNT;

  DELETE FROM public.purchase_request_history WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_request_history = ROW_COUNT;

  DELETE FROM public.reports WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_reports = ROW_COUNT;

  DELETE FROM public.item_moderation_flags WHERE item_id = target_item_id;
  GET DIAGNOSTICS deleted_flags = ROW_COUNT;

  DELETE FROM public.items WHERE id = target_item_id;

  RETURN jsonb_build_object(
    'itemId', target_item_id,
    'title', item_record.title,
    'sellerId', item_record.seller_id,
    'previousStatus', item_record.status,
    'deletedFavorites', deleted_favorites,
    'deletedMessages', deleted_messages,
    'deletedNotifications', deleted_notifications,
    'deletedLockAttempts', deleted_lock_attempts,
    'deletedRequestHistory', deleted_request_history,
    'deletedReports', deleted_reports,
    'deletedFlags', deleted_flags
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_item(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
