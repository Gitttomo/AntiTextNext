-- Add is_read column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN messages.is_read IS 'Whether the message has been read by the receiver';
