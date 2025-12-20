-- Add finalized meetup details to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS final_meetup_time text,
ADD COLUMN IF NOT EXISTS final_meetup_location text;

-- Add comments for clarity
COMMENT ON COLUMN transactions.final_meetup_time IS 'Agreed upon time for the meetup (e.g., "12/21 (Sat) Lunch")';
COMMENT ON COLUMN transactions.final_meetup_location IS 'Agreed upon location for the meetup';
