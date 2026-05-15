DROP TRIGGER IF EXISTS validate_transaction_update_trigger ON public.transactions;

CREATE OR REPLACE FUNCTION public.normalize_transaction_statuses()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transactions SET status = 'requested' WHERE status = 'pending_approval';
  UPDATE public.transactions SET status = 'accepted' WHERE status = 'pending';
  UPDATE public.transactions SET status = 'scheduled' WHERE status = 'confirmed';
  UPDATE public.transactions SET status = 'rejected' WHERE status = 'declined';
  UPDATE public.items SET status = 'trading' WHERE status = 'transaction_pending';
END;
$$;

SELECT public.normalize_transaction_statuses();

DROP INDEX IF EXISTS transactions_one_active_per_item;
DROP INDEX IF EXISTS transactions_one_active_per_buyer_item;
DROP INDEX IF EXISTS transactions_one_accepted_per_item;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_active_per_buyer_item
ON public.transactions(item_id, buyer_id)
WHERE status IN ('requested', 'accepted', 'scheduling', 'scheduled', 'awaiting_rating');

CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_accepted_per_item
ON public.transactions(item_id)
WHERE status IN ('accepted', 'scheduling', 'scheduled', 'awaiting_rating');

CREATE OR REPLACE FUNCTION public.check_purchase_eligibility(
  p_buyer_id UUID,
  p_item_id UUID,
  p_seller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_request_count INTEGER;
BEGIN
  IF p_buyer_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'authentication_required');
  END IF;

  IF p_buyer_id = p_seller_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'seller_cannot_buy_own_item');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE item_id = p_item_id
      AND buyer_id = p_buyer_id
      AND status IN ('requested', 'accepted', 'scheduling', 'scheduled', 'awaiting_rating')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'pending_request_exists');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE item_id = p_item_id
      AND status IN ('accepted', 'scheduling', 'scheduled', 'awaiting_rating')
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'active_transaction_exists');
  END IF;

  SELECT COUNT(*)
  INTO pending_request_count
  FROM public.transactions
  WHERE item_id = p_item_id
    AND status = 'requested';

  IF pending_request_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'request_limit_reached');
  END IF;

  RETURN jsonb_build_object('allowed', true);
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
  eligibility JSONB;
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

  eligibility := public.check_purchase_eligibility(auth.uid(), target_item_id, item_record.seller_id);
  IF NOT (eligibility->>'allowed')::boolean THEN
    RAISE EXCEPTION 'eligibility check failed: %', eligibility->>'reason';
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
    'requested'
  )
  RETURNING id INTO transaction_id;

  INSERT INTO public.purchase_request_history(item_id, buyer_id, seller_id, status)
  VALUES (target_item_id, auth.uid(), item_record.seller_id, 'requested');

  UPDATE public.items
  SET locked_by = NULL,
      locked_until = NULL
  WHERE id = target_item_id;

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
    '購入リクエストの承認待ち',
    COALESCE(buyer_nickname, '購入者') || 'さんから購入リクエストが届きました。チャットで確認し、承認または辞退してください。',
    'chat',
    target_item_id::text || '?tx=' || transaction_id::text,
    false
  );

  RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_purchase_request(target_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT t.*, i.title
  INTO tx_record
  FROM public.transactions t
  JOIN public.items i ON i.id = t.item_id
  WHERE t.id = target_transaction_id
  FOR UPDATE;

  IF tx_record.id IS NULL THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  IF tx_record.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only seller can accept this request';
  END IF;

  IF tx_record.status <> 'requested' THEN
    RAISE EXCEPTION 'request is not awaiting approval';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions
    WHERE item_id = tx_record.item_id
      AND id <> tx_record.id
      AND status IN ('accepted', 'scheduling', 'scheduled', 'awaiting_rating')
  ) THEN
    RAISE EXCEPTION 'another transaction is already active';
  END IF;

  UPDATE public.transactions
  SET status = 'accepted'
  WHERE id = tx_record.id;

  UPDATE public.items
  SET status = 'trading',
      locked_by = NULL,
      locked_until = NULL
  WHERE id = tx_record.item_id;

  UPDATE public.transactions
  SET status = 'auto_closed'
  WHERE item_id = tx_record.item_id
    AND id <> tx_record.id
    AND status = 'requested';

  INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
  VALUES (
    tx_record.item_id,
    tx_record.seller_id,
    tx_record.buyer_id,
    '【リクエスト承認】' || chr(10) || '出品者が購入リクエストを承認しました。日程を調整しましょう！',
    false
  );

  INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
  SELECT
    tx_record.item_id,
    tx_record.seller_id,
    t.buyer_id,
    '【リクエスト終了】' || chr(10) || '他の方との取引が開始されたため、このリクエストは終了しました。',
    false
  FROM public.transactions t
  WHERE t.item_id = tx_record.item_id
    AND t.id <> tx_record.id
    AND t.status = 'auto_closed';

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  VALUES (
    tx_record.buyer_id,
    'purchase_request',
    '購入リクエストが承認されました',
    '「' || tx_record.title || '」の購入リクエストが承認されました。チャットで日程を調整してください。',
    'chat',
    tx_record.item_id::text || '?tx=' || tx_record.id::text,
    false
  );

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  SELECT
    t.buyer_id,
    'purchase_request',
    '購入リクエストが終了しました',
    '「' || tx_record.title || '」は他の方との取引が開始されたため、リクエストを終了しました。',
    'chat',
    tx_record.item_id::text || '?tx=' || t.id::text,
    false
  FROM public.transactions t
  WHERE t.item_id = tx_record.item_id
    AND t.id <> tx_record.id
    AND t.status = 'auto_closed';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_purchase_request(
  target_transaction_id UUID,
  reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx_record RECORD;
BEGIN
  SELECT t.*, i.title
  INTO tx_record
  FROM public.transactions t
  JOIN public.items i ON i.id = t.item_id
  WHERE t.id = target_transaction_id
  FOR UPDATE;

  IF tx_record.id IS NULL THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  IF tx_record.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'only seller can reject this request';
  END IF;

  IF tx_record.status <> 'requested' THEN
    RAISE EXCEPTION 'request is not awaiting approval';
  END IF;

  UPDATE public.transactions
  SET status = 'rejected',
      decline_reason = NULLIF(TRIM(COALESCE(reason, '')), ''),
      declined_at = NOW()
  WHERE id = tx_record.id;

  INSERT INTO public.messages(item_id, sender_id, receiver_id, message, is_read)
  VALUES (
    tx_record.item_id,
    tx_record.seller_id,
    tx_record.buyer_id,
    '【リクエスト辞退】' || chr(10) || '出品者が購入リクエストを辞退しました。' ||
      CASE WHEN NULLIF(TRIM(COALESCE(reason, '')), '') IS NULL THEN '' ELSE chr(10) || chr(10) || '理由: ' || TRIM(reason) END,
    false
  );

  INSERT INTO public.notifications(user_id, type, title, message, link_type, link_id, is_read)
  VALUES (
    tx_record.buyer_id,
    'transaction_cancelled',
    '購入リクエストが辞退されました',
    '「' || tx_record.title || '」への購入リクエストが出品者により辞退されました。',
    'chat',
    tx_record.item_id::text || '?tx=' || tx_record.id::text,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_old_purchase_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  PERFORM set_config('app.bypass_transaction_update_guard', 'on', true);

  UPDATE public.transactions
  SET status = 'expired'
  WHERE status = 'requested'
    AND created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_item_pending_after_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'requested' THEN
    UPDATE public.items
    SET locked_by = NULL,
        locked_until = NULL
    WHERE id = NEW.item_id
      AND locked_by = NEW.buyer_id;
    RETURN NEW;
  END IF;

  UPDATE public.items
  SET status = 'trading',
      locked_by = NULL,
      locked_until = NULL
  WHERE id = NEW.item_id
    AND locked_by = NEW.buyer_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'sender_id must be current user';
  END IF;

  IF NOT public.is_user_operational(auth.uid()) THEN
    RAISE EXCEPTION 'account is restricted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.item_id = NEW.item_id
      AND (
        (t.buyer_id = NEW.sender_id AND t.seller_id = NEW.receiver_id)
        OR
        (t.seller_id = NEW.sender_id AND t.buyer_id = NEW.receiver_id)
      )
      AND t.status IN (
        'requested', 'accepted', 'scheduling', 'scheduled', 'awaiting_rating',
        'completed', 'cancelled', 'rejected', 'expired', 'auto_closed',
        'pending_approval', 'pending', 'confirmed', 'declined'
      )
  ) THEN
    RAISE EXCEPTION 'message participants do not match transaction';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_transaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role TEXT := auth.role();
BEGIN
  IF current_setting('app.bypass_transaction_update_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(actor_role, '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  IF actor_id NOT IN (OLD.buyer_id, OLD.seller_id) THEN
    RAISE EXCEPTION 'only transaction participants can update transaction';
  END IF;

  IF NOT public.is_user_operational(actor_id) THEN
    RAISE EXCEPTION 'account is restricted';
  END IF;

  IF NEW.item_id IS DISTINCT FROM OLD.item_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'transaction parties cannot be changed';
  END IF;

  IF OLD.status = 'requested'
     AND NEW.status IN ('accepted', 'rejected')
     AND actor_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'only seller can accept or reject purchase requests';
  END IF;

  IF OLD.status IN ('completed', 'cancelled', 'rejected', 'expired', 'auto_closed')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'terminal transaction cannot be reopened';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_transaction_update_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_update_trigger
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_update();

GRANT EXECUTE ON FUNCTION public.check_purchase_eligibility(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_purchase_request(UUID, TEXT, TEXT[], TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_purchase_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_purchase_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_purchase_requests() TO authenticated;

NOTIFY pgrst, 'reload schema';
