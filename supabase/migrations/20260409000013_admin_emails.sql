CREATE TABLE IF NOT EXISTS public.admin_emails (
    email TEXT PRIMARY KEY,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_emails FROM anon;
REVOKE ALL ON public.admin_emails FROM authenticated;

CREATE OR REPLACE FUNCTION public.is_allowed_admin_email(target_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_emails
        WHERE email = LOWER(TRIM(target_email))
    );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_emails
        WHERE email = LOWER(TRIM(COALESCE(auth.jwt()->>'email', '')))
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_admin_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_admin_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
