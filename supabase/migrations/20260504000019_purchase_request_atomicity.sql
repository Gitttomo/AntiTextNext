CREATE TABLE IF NOT EXISTS public.purchase_lock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL DEFAULT 'started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchase_lock_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_purchase_lock_attempts_item_created
ON public.purchase_lock_attempts(item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.acquire_item_lock(
  target_item_id UUID,
  locker_id UUID,
  lock_until TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_time TIMESTAMPTZ := clock_timestamp();
  competing_users INTEGER := 0;
  lock_acquired BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR locker_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  IF NOT public.is_user_operational(auth.uid()) THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.purchase_lock_attempts
  WHERE created_at < NOW() - INTERVAL '1 day';

  INSERT INTO public.purchase_lock_attempts(item_id, user_id)
  VALUES (target_item_id, auth.uid());

  -- Give near-simultaneous attempts a short window to become visible.
  -- If more than one user arrives in this window, reject all of them instead of picking a winner.
  PERFORM pg_sleep(0.45);

  SELECT COUNT(DISTINCT user_id)
  INTO competing_users
  FROM public.purchase_lock_attempts
  WHERE item_id = target_item_id
    AND created_at BETWEEN attempt_time - INTERVAL '750 milliseconds'
                       AND attempt_time + INTERVAL '750 milliseconds';

  IF competing_users > 1 THEN
    UPDATE public.purchase_lock_attempts
    SET outcome = 'contended'
    WHERE item_id = target_item_id
      AND created_at BETWEEN attempt_time - INTERVAL '750 milliseconds'
                         AND attempt_time + INTERVAL '750 milliseconds';

    UPDATE public.items
    SET locked_by = NULL,
        locked_until = NULL
    WHERE id = target_item_id
      AND status = 'available'
      AND locked_until > NOW()
      AND locked_by IN (
        SELECT user_id
        FROM public.purchase_lock_attempts
        WHERE item_id = target_item_id
          AND created_at BETWEEN attempt_time - INTERVAL '750 milliseconds'
                             AND attempt_time + INTERVAL '750 milliseconds'
      );

    RETURN FALSE;
  END IF;

  UPDATE public.items
  SET
    locked_by = auth.uid(),
    locked_until = NOW() + INTERVAL '10 minutes'
  WHERE
    id = target_item_id
    AND seller_id <> auth.uid()
    AND status = 'available'
    AND (
      locked_by IS NULL
      OR locked_until < NOW()
      OR locked_by = auth.uid()
    );

  lock_acquired := FOUND;

  UPDATE public.purchase_lock_attempts
  SET outcome = CASE WHEN lock_acquired THEN 'locked' ELSE 'rejected' END
  WHERE item_id = target_item_id
    AND user_id = auth.uid()
    AND created_at = (
      SELECT MAX(created_at)
      FROM public.purchase_lock_attempts
      WHERE item_id = target_item_id
        AND user_id = auth.uid()
    );

  RETURN lock_acquired;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_purchase_request(
  target_item_id UUID,
  payment_method TEXT,
  meetup_time_slots TEXT[],
  meetup_locations TEXT[],
  auto_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
  transaction_id UUID;
  buyer_nickname TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NOT public.is_user_operational(auth.uid()) THEN
    RAISE EXCEPTION 'account is restricted';
  END IF;

  SELECT id, title, seller_id, status, locked_by, locked_until
  INTO item_record
  FROM public.items
  WHERE id = target_item_id
  FOR UPDATE;

  IF item_record.id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  IF item_record.seller_id = auth.uid() THEN
    RAISE EXCEPTION 'seller cannot buy own item';
  END IF;

  IF item_record.status <> 'available' THEN
    RAISE EXCEPTION 'item is not available';
  END IF;

  IF item_record.locked_by IS DISTINCT FROM auth.uid()
     OR item_record.locked_until IS NULL
     OR item_record.locked_until <= NOW() THEN
    RAISE EXCEPTION 'valid purchase lock is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.item_id = target_item_id
      AND t.status IN ('pending', 'confirmed', 'awaiting_rating')
  ) THEN
    RAISE EXCEPTION 'active transaction already exists';
  END IF;

  INSERT INTO public.transactions(
    item_id,
    buyer_id,
    seller_id,
    payment_method,
    meetup_time_slots,
    meetup_locations,
    status
  )
  VALUES (
    target_item_id,
    auth.uid(),
    item_record.seller_id,
    payment_method,
    meetup_time_slots,
    meetup_locations,
    'pending'
  )
  RETURNING id INTO transaction_id;

  INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
  VALUES (target_item_id, auth.uid(), item_record.seller_id, auto_message, false);

  SELECT COALESCE(nickname, '購入者')
  INTO buyer_nickname
  FROM public.profiles
  WHERE user_id = auth.uid();

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  VALUES (
    item_record.seller_id,
    'purchase_request',
    '新しい購入リクエスト',
    COALESCE(buyer_nickname, '購入者') || 'さんから購入リクエストが届きました。チャットで日程を調整してください。',
    'chat',
    target_item_id,
    false
  );

  RETURN transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_item_lock(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_purchase_request(UUID, TEXT, TEXT[], TEXT[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
