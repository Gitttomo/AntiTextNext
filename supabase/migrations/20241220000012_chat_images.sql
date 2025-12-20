-- Add image_url to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create a bucket for chat images if it doesn't exist
-- Note: Supabase storage buckets are managed via the storage schema, 
-- but we can use an RPC or just assume it will be created via UI/API.
-- Here we just define the column. 

COMMENT ON COLUMN messages.image_url IS 'URL of the image attached to the message (stored in Supabase Storage)';
