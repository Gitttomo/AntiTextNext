-- Fix: Ensure sellers can see and act on pending_approval transactions
-- This migration fixes the issue where sellers could not see the approve/decline
-- buttons in the chat page because the transaction RLS policies were too restrictive
-- or were missing coverage for pending_approval status.

-- ===== 1. Fix RLS policies on transactions =====
-- Drop any existing SELECT policies that may be blocking pending_approval visibility

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Transactions are viewable by participants" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Participants can view all transactions" ON public.transactions;

-- Create a comprehensive SELECT policy that covers ALL statuses including pending_approval
CREATE POLICY "Participants can view all their transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ===== 2. Fix UPDATE policy for sellers (approve/decline) =====

DROP POLICY IF EXISTS "Sellers can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Sellers and buyers can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;

-- Sellers can approve/decline (update pending_approval → pending/declined)
-- Buyers and sellers can both update ongoing transaction fields
CREATE POLICY "Participants can update their transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ===== 3. Re-apply submit_purchase_request to guarantee pending_approval status =====
-- (Idempotent - safe to run multiple times. Ensures the correct version is active.)

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

  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.item_id = target_item_id
      AND t.status IN ('pending_approval', 'pending', 'confirmed', 'awaiting_rating')
  ) THEN
    RAISE EXCEPTION 'active transaction already exists';
  END IF;

  -- Verify purchase eligibility (max attempts, cooldown)
  eligibility := public.check_purchase_eligibility(auth.uid(), target_item_id, item_record.seller_id);
  IF NOT (eligibility->>'allowed')::boolean THEN
    RAISE EXCEPTION 'eligibility check failed: %', eligibility->>'reason';
  END IF;

  -- Create transaction with pending_approval status (seller must approve first)
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
    'pending_approval'
  )
  RETURNING id INTO transaction_id;

  -- Record in purchase request history
  INSERT INTO public.purchase_request_history(
    item_id,
    buyer_id,
    seller_id,
    status
  )
  VALUES (
    target_item_id,
    auth.uid(),
    item_record.seller_id,
    'pending_approval'
  );

  -- Release the lock (item stays 'available' until seller approves)
  UPDATE public.items
  SET
    locked_by = NULL,
    locked_until = NULL
  WHERE
    id = target_item_id;

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
    target_item_id,
    false
  );

  RETURN transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_purchase_request(UUID, TEXT, TEXT[], TEXT[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
