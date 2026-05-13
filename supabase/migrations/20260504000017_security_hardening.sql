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
  now_time TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NULL OR locker_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.items
  SET
    locked_by = auth.uid(),
    locked_until = now_time + INTERVAL '10 minutes'
  WHERE
    id = target_item_id
    AND seller_id <> auth.uid()
    AND status = 'available'
    AND (
      locked_by IS NULL
      OR locked_until < now_time
      OR locked_by = auth.uid()
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_watch_keyword_matches(target_item_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT id, title, seller_id, status
  INTO item_record
  FROM public.items
  WHERE id = target_item_id;

  IF item_record.id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  IF item_record.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only seller can notify watch keyword matches';
  END IF;

  IF item_record.status <> 'available' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  SELECT DISTINCT
    wk.user_id,
    'watch_match',
    '探していた教科書が出品されました！',
    '「' || item_record.title || '」が出品されました。早めにチェックしてみてください！',
    'search',
    item_record.title,
    false
  FROM public.watch_keywords wk
  WHERE wk.user_id <> item_record.seller_id
    AND item_record.title ILIKE '%' || wk.keyword || '%';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

DROP POLICY IF EXISTS "Service can read all watch keywords" ON public.watch_keywords;

DROP POLICY IF EXISTS "Users can rate their transactions" ON public.ratings;
CREATE POLICY "Users can rate their own counterparty transactions"
ON public.ratings
FOR INSERT
WITH CHECK (
  auth.uid() = rater_id
  AND EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = transaction_id
      AND t.status = 'awaiting_rating'
      AND (
        (t.buyer_id = auth.uid() AND t.seller_id = rated_id)
        OR
        (t.seller_id = auth.uid() AND t.buyer_id = rated_id)
      )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ratings_one_per_rater_per_transaction
ON public.ratings(transaction_id, rater_id);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_active_per_item
ON public.transactions(item_id)
WHERE status IN ('pending', 'confirmed', 'awaiting_rating');

CREATE OR REPLACE FUNCTION public.validate_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT id, seller_id, status, locked_by, locked_until
  INTO item_record
  FROM public.items
  WHERE id = NEW.item_id;

  IF item_record.id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'buyer_id must be current user';
  END IF;

  IF NEW.seller_id IS DISTINCT FROM item_record.seller_id THEN
    RAISE EXCEPTION 'seller_id does not match item seller';
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_transaction_insert_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_insert_trigger
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_insert();

GRANT EXECUTE ON FUNCTION public.acquire_item_lock(UUID, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_watch_keyword_matches(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
