CREATE OR REPLACE FUNCTION public.is_user_operational(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = target_user_id
      AND COALESCE(p.is_deactivated, false) = false
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_restrictions ur
    WHERE ur.user_id = target_user_id
      AND ur.lifted_at IS NULL
      AND (ur.ends_at IS NULL OR ur.ends_at > NOW())
      AND ur.restriction_type IN ('temporary_suspend', 'permanent_ban', 'chat_stop', 'listing_stop', 'purchase_stop')
  );
$$;

CREATE OR REPLACE FUNCTION public.release_item_lock(target_item_id UUID, locker_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR locker_id IS DISTINCT FROM auth.uid() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.items
  SET locked_by = NULL,
      locked_until = NULL
  WHERE id = target_item_id
    AND locked_by = auth.uid();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_item_pending_after_transaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.items
  SET status = 'transaction_pending',
      locked_by = NULL,
      locked_until = NULL
  WHERE id = NEW.item_id
    AND locked_by = NEW.buyer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_item_pending_after_transaction_insert_trigger ON public.transactions;
CREATE TRIGGER mark_item_pending_after_transaction_insert_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.mark_item_pending_after_transaction_insert();

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
      AND t.status IN ('pending', 'confirmed', 'awaiting_rating', 'completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'message participants do not match transaction';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_message_insert_trigger ON public.messages;
CREATE TRIGGER validate_message_insert_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_insert();

CREATE OR REPLACE FUNCTION public.validate_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF NEW.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'seller_id must be current user';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_restrictions ur
    WHERE ur.user_id = auth.uid()
      AND ur.lifted_at IS NULL
      AND (ur.ends_at IS NULL OR ur.ends_at > NOW())
      AND ur.restriction_type IN ('temporary_suspend', 'permanent_ban', 'listing_stop')
  ) THEN
    RAISE EXCEPTION 'listing is restricted';
  END IF;

  IF NOT public.is_user_operational(auth.uid()) THEN
    RAISE EXCEPTION 'account is restricted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_item_insert_trigger ON public.items;
CREATE TRIGGER validate_item_insert_trigger
BEFORE INSERT ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.validate_item_insert();

CREATE OR REPLACE FUNCTION public.validate_transaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF auth.uid() NOT IN (OLD.buyer_id, OLD.seller_id) THEN
    RAISE EXCEPTION 'only transaction participants can update transaction';
  END IF;

  IF NOT public.is_user_operational(auth.uid()) THEN
    RAISE EXCEPTION 'account is restricted';
  END IF;

  IF NEW.item_id IS DISTINCT FROM OLD.item_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'transaction parties cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_transaction_update_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_update_trigger
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_update();

GRANT EXECUTE ON FUNCTION public.is_user_operational(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_item_lock(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
