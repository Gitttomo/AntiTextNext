-- Optimize transactions table lookups
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_item_id ON transactions(item_id);

-- Optimize message unread status lookups
CREATE INDEX IF NOT EXISTS idx_messages_receiver_is_read ON messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_item_id ON messages(item_id);

-- Optimize items table for seller lookups
CREATE INDEX IF NOT EXISTS idx_items_seller_id ON items(seller_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- Add comments
COMMENT ON INDEX idx_messages_receiver_is_read IS 'Speeds up unread message count calculation for a specific user';
COMMENT ON INDEX idx_transactions_buyer_id IS 'Speeds up transaction list fetching for buyers';
COMMENT ON INDEX idx_transactions_seller_id IS 'Speeds up transaction list fetching for sellers';
