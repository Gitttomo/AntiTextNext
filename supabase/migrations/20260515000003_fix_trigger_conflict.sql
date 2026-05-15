-- Fix: Drop the validate_transaction_insert trigger
-- 
-- This trigger was created in security_hardening migration to prevent direct
-- INSERT into transactions. However, it conflicts with the submit_purchase_request
-- RPC function (SECURITY DEFINER) which now handles ALL validation atomically.
--
-- Problem: The trigger re-validates the lock and item status independently,
-- but the RPC function already validated these and may have modified state
-- (e.g., releasing the lock after validation). This causes valid purchase
-- requests to fail with "valid purchase lock is required" errors.
--
-- Since submit_purchase_request is SECURITY DEFINER and performs comprehensive
-- validation, the trigger is redundant and harmful.

DROP TRIGGER IF EXISTS validate_transaction_insert_trigger ON public.transactions;

-- Also update the unique index to include pending_approval status
-- This prevents duplicate active transactions for the same item
DROP INDEX IF EXISTS transactions_one_active_per_item;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_active_per_item
ON public.transactions(item_id)
WHERE status IN ('pending_approval', 'pending', 'confirmed', 'awaiting_rating');

NOTIFY pgrst, 'reload schema';
