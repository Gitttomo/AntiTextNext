-- =============================================================
-- Fix 1: validate_message_insert に pending_approval を追加
-- =============================================================
CREATE OR REPLACE FUNCTION public.validate_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
      AND t.status IN ('pending_approval', 'pending', 'confirmed', 'awaiting_rating', 'completed', 'cancelled', 'declined')
  ) THEN
    RAISE EXCEPTION 'message participants do not match transaction';
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================
-- Fix 2: mark_item_pending_after_transaction_insert を修正
-- =============================================================
-- pending_approval のときはアイテムを available のままにする
CREATE OR REPLACE FUNCTION public.mark_item_pending_after_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- pending_approval の場合はアイテムステータスを変更しない
  IF NEW.status = 'pending_approval' THEN
    UPDATE public.items
    SET locked_by = NULL,
        locked_until = NULL
    WHERE id = NEW.item_id
      AND locked_by = NEW.buyer_id;
    RETURN NEW;
  END IF;

  -- pending 等の場合のみ transaction_pending にする
  UPDATE public.items
  SET status = 'transaction_pending',
      locked_by = NULL,
      locked_until = NULL
  WHERE id = NEW.item_id
    AND locked_by = NEW.buyer_id;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
