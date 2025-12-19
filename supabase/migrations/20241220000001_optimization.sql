-- Add a foreign key to allow joining items with profiles
-- This allows fetching item details and seller nickname in a single query

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_seller_id_fkey_profiles') THEN
        ALTER TABLE items
        ADD CONSTRAINT items_seller_id_fkey_profiles
        FOREIGN KEY (seller_id)
        REFERENCES profiles (user_id);
    END IF;
END $$;
