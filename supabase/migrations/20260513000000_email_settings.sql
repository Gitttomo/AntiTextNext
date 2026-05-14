-- Add email notification preferences and locale to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notify_watch_keywords BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notify_transaction_progress BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notify_reminders BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notify_chat_messages BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'ja';
