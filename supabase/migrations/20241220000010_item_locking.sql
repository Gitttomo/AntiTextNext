-- Add locking columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMENT ON COLUMN items.locked_by IS 'The ID of the user who currently has the right to purchase this item.';
COMMENT ON COLUMN items.locked_until IS 'The expiration time of the purchase right lock.';
