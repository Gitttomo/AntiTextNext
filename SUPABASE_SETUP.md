# Supabase Database Setup Guide

This guide will help you set up the database tables and storage bucket for the TextNext app.

## Step 1: Create Tables

Go to the SQL Editor in your Supabase dashboard and run the following SQL commands:

### 1. Profiles Table

```sql
CREATE TABLE profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nickname TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 2. Items Table

**Item Status Values:**
- `available`: 販売中（誰でも購入可能）
- `reserved`: 予約中（購入リクエストページで選択中、10分以内）
- `transaction_pending`: 取引中（購入リクエスト送信済み、日程調整中）
- `sold`: 売却済み（取引完了）

```sql
CREATE TABLE items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  original_price INTEGER NOT NULL,
  selling_price INTEGER NOT NULL,
  condition TEXT NOT NULL,
  status TEXT DEFAULT 'available' NOT NULL,
  front_image_url TEXT,
  back_image_url TEXT,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Policies
-- 誰でも販売中・取引中のアイテムを閲覧可能
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own items"
  ON items FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- 出品者と購入リクエストした購入者がステータスを更新可能
CREATE POLICY "Users can update items"
  ON items FOR UPDATE
  USING (true);
```

### 3. Search Histories Table

```sql
CREATE TABLE search_histories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE search_histories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own search history"
  ON search_histories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history"
  ON search_histories FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 4. Messages Table

```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies (only buyer/seller of transaction can view/send)
CREATE POLICY "Users can view messages they're involved in"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### Migration: Add missing fields to existing messages table

```sql
-- 既存のテーブルがある場合、このSQLを実行
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### 5. Transactions Table (購入リクエスト用)

**Transaction Status Values:**
- `pending`: 日程調整中
- `confirmed`: 日程確定済み
- `awaiting_rating`: 評価待ち (少なくとも一方のユーザーが取引完了ボタンを押して評価送信済み)
- `completed`: 取引完了 (双方が評価を送信済み)
- `cancelled`: キャンセル済み

```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_method TEXT NOT NULL,
  meetup_time_slots TEXT[] NOT NULL,
  meetup_locations TEXT[] NOT NULL,
  final_meetup_time TEXT,
  final_meetup_location TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  buyer_completed BOOLEAN DEFAULT FALSE,
  seller_completed BOOLEAN DEFAULT FALSE,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Authenticated users can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
```

## Step 2: Create Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click "Create a new bucket"
3. Name it: `item-images`
4. Make it **Public** (so images can be displayed)
5. Click "Create bucket"

### Set Storage Policies

After creating the bucket, go to the bucket's policies:

```sql
-- Allow anyone to view images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-images' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 6. Notifications Table (通知用)

```sql
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_type TEXT,
  link_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

**Notification Types:**
- `rating_received`: 評価が送信されました
- `transaction_completed`: 取引が完了しました
- `message`: 新しいメッセージ
- `transaction_cancelled`: 取引がキャンセルされました

**Link Types:**
- `chat`: チャットページへのリンク (link_id = item_id)
- `transaction`: 取引ページへのリンク
- `profile`: プロフィールページへのリンク

## Step 3: Configure Email Authentication

1. Go to **Authentication** > **Providers** in your Supabase dashboard
2. Make sure **Email** is enabled
3. Configure your email templates if needed
4. For testing, you can disable email confirmation temporarily

## Step 4: Migration for Existing Databases

If you already have existing tables, run these migrations to add the new fields:

```sql
-- Add new fields to transactions table for buyer/seller completion tracking
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS final_meetup_time TEXT,
ADD COLUMN IF NOT EXISTS final_meetup_location TEXT,
ADD COLUMN IF NOT EXISTS buyer_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS seller_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add reservation lock fields to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;
```

## Step 5: Create RPC Functions

These functions handle the reservation lock system securely on the database side.

```sql
-- Function to acquire item lock (reservation)
CREATE OR REPLACE FUNCTION acquire_item_lock(
  target_item_id UUID,
  locker_id UUID,
  lock_until TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if item is available and not locked, or lock has expired
  UPDATE items
  SET
    status = 'reserved',
    locked_by = locker_id,
    locked_until = lock_until
  WHERE
    id = target_item_id
    AND status = 'available'
    AND (
      locked_by IS NULL
      OR locked_until < NOW()
    );

  -- Return true if update was successful
  RETURN FOUND;
END;
$$;

-- Function to release item lock (cancel reservation)
CREATE OR REPLACE FUNCTION release_item_lock(
  target_item_id UUID,
  locker_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Release lock only if the user is the one who locked it
  UPDATE items
  SET
    status = 'available',
    locked_by = NULL,
    locked_until = NULL
  WHERE
    id = target_item_id
    AND locked_by = locker_id;

  RETURN FOUND;
END;
$$;
```

## You're Done!

Your database is now set up and ready to use with the TextNext app.

Make sure your `.env.local` file has the correct Supabase URL and anon key, then start the development server with `npm run dev`.
