-- Add image_url to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;

-- Create a bucket for chat images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the chat-images bucket
-- 1. Allow public select access to all files
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- 2. Allow authenticated users to upload files
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-images' AND auth.role() = 'authenticated');

-- 3. Allow owners to delete their own files
CREATE POLICY "Owner Delete Access"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-images' AND auth.uid() = owner);

COMMENT ON COLUMN messages.image_url IS 'URL of the image attached to the message (stored in Supabase Storage)';
