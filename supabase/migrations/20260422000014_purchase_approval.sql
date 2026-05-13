-- Purchase Request Approval System
-- Adds support for seller approval/decline of purchase requests

-- Add decline tracking columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz;

-- Create purchase request tracking table (for cooldown and attempt limits)
CREATE TABLE IF NOT EXISTS purchase_request_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval', -- pending_approval, approved, declined, auto_declined
  decline_reason text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Index for checking cooldown and attempt limits
CREATE INDEX IF NOT EXISTS idx_purchase_request_history_buyer_item
  ON purchase_request_history(buyer_id, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_request_history_status
  ON purchase_request_history(status, created_at);

-- Function to check if a buyer can send a purchase request
-- Returns: { allowed: boolean, reason: string }
CREATE OR REPLACE FUNCTION check_purchase_eligibility(
  p_buyer_id uuid,
  p_item_id uuid,
  p_seller_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_decline_count integer;
  v_last_decline_at timestamptz;
  v_hours_since_decline numeric;
BEGIN
  -- Count total declines for this buyer-item pair
  SELECT COUNT(*), MAX(resolved_at)
  INTO v_decline_count, v_last_decline_at
  FROM purchase_request_history
  WHERE buyer_id = p_buyer_id
    AND item_id = p_item_id
    AND status IN ('declined', 'auto_declined');

  -- Check: max 2 attempts
  IF v_decline_count >= 2 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'max_attempts_reached'
    );
  END IF;

  -- Check: 24h cooldown after last decline
  IF v_last_decline_at IS NOT NULL THEN
    v_hours_since_decline := EXTRACT(EPOCH FROM (now() - v_last_decline_at)) / 3600;
    IF v_hours_since_decline < 24 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'cooldown_active',
        'hours_remaining', CEIL(24 - v_hours_since_decline)
      );
    END IF;
  END IF;

  -- Check: no active pending request for this item from this buyer
  IF EXISTS (
    SELECT 1 FROM purchase_request_history
    WHERE buyer_id = p_buyer_id
      AND item_id = p_item_id
      AND status = 'pending_approval'
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'pending_request_exists'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;
