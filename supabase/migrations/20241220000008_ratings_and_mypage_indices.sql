-- Create ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id),
    rater_id UUID NOT NULL REFERENCES auth.users(id),
    rated_id UUID NOT NULL REFERENCES auth.users(id),
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can rate their transactions" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON public.ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status_composite ON public.transactions(seller_id, buyer_id, status);
