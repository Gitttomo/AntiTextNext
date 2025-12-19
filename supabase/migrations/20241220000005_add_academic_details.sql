-- Add academic details to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS degree text,
ADD COLUMN IF NOT EXISTS grade integer,
ADD COLUMN IF NOT EXISTS major text;

-- Add comments for clarity
COMMENT ON COLUMN profiles.degree IS 'Academic degree (学士, 修士, 博士)';
COMMENT ON COLUMN profiles.grade IS 'Year in school (1-5)';
COMMENT ON COLUMN profiles.major IS 'Major/Department (系)';
