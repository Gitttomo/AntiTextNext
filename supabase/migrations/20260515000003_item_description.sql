ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.items.description IS 'Optional seller-provided item condition/details. UI limits to 100 characters.';

NOTIFY pgrst, 'reload schema';
