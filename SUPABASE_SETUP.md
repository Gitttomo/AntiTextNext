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
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view messages they're involved in"
  ON messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### 5. Transactions Table (購入リクエスト用)

```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_method TEXT NOT NULL,
  meetup_time_slots TEXT[] NOT NULL,
  meetup_locations TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
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

## Step 3: Configure Email Authentication

1. Go to **Authentication** > **Providers** in your Supabase dashboard
2. Make sure **Email** is enabled
3. Configure your email templates if needed
4. For testing, you can disable email confirmation temporarily

## You're Done!

Your database is now set up and ready to use with the TextNext app. 

Make sure your `.env.local` file has the correct Supabase URL and anon key, then start the development server with `npm run dev`.
