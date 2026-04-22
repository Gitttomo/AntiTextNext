ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS schedule_change_requested_by UUID,
ADD COLUMN IF NOT EXISTS previous_final_meetup_time TEXT,
ADD COLUMN IF NOT EXISTS previous_final_meetup_location TEXT;
