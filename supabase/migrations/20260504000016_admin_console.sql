CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID,
  reported_user_id UUID,
  item_id UUID,
  transaction_id UUID,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID,
  sender_name TEXT,
  email TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id UUID,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restriction_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  lifted_at TIMESTAMPTZ,
  related_report_id UUID,
  related_transaction_id UUID,
  admin_note TEXT,
  user_notice TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.item_moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  flag_type TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible',
ADD COLUMN IF NOT EXISTS moderation_note TEXT,
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_moderation_flags ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.admin_action_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_restrictions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.item_moderation_flags TO authenticated;
GRANT UPDATE (moderation_status, moderation_note, hidden_at, deleted_at) ON public.items TO authenticated;

CREATE OR REPLACE FUNCTION public.mask_email(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
BEGIN
  IF target_email IS NULL OR POSITION('@' IN target_email) = 0 THEN
    RETURN NULL;
  END IF;

  local_part := SPLIT_PART(target_email, '@', 1);
  domain_part := SPLIT_PART(target_email, '@', 2);

  IF LENGTH(local_part) <= 3 THEN
    RETURN LEFT(local_part, 1) || '***@' || domain_part;
  END IF;

  RETURN LEFT(local_part, 3) || '***@' || domain_part;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_log_action(
  action_type TEXT,
  target_type TEXT,
  target_id TEXT,
  reason TEXT DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id UUID;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  INSERT INTO public.admin_action_logs(admin_user_id, action_type, target_type, target_id, reason, metadata)
  VALUES (auth.uid(), action_type, target_type, target_id, reason, COALESCE(metadata, '{}'::jsonb))
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_users(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_list_users(
  ban_filter TEXT DEFAULT NULL,
  search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  nickname TEXT,
  avatar_url TEXT,
  department TEXT,
  degree TEXT,
  grade INT,
  major TEXT,
  masked_email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  transaction_count BIGINT,
  report_count BIGINT,
  restriction_status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH active_restrictions AS (
    SELECT DISTINCT ON (ur.user_id)
      ur.user_id,
      ur.restriction_type
    FROM public.user_restrictions ur
    WHERE ur.lifted_at IS NULL
      AND (ur.ends_at IS NULL OR ur.ends_at > NOW())
    ORDER BY ur.user_id, ur.created_at DESC
  )
  SELECT
    p.user_id,
    p.nickname,
    p.avatar_url,
    p.department,
    p.degree,
    p.grade,
    p.major,
    public.mask_email(u.email) AS masked_email,
    p.created_at,
    u.last_sign_in_at,
    COUNT(DISTINCT t.id) AS transaction_count,
    COUNT(DISTINCT r.id) AS report_count,
    COALESCE(ar.restriction_type, 'none') AS restriction_status
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.transactions t ON t.buyer_id = p.user_id OR t.seller_id = p.user_id
  LEFT JOIN public.reports r ON r.reported_user_id = p.user_id
  LEFT JOIN active_restrictions ar ON ar.user_id = p.user_id
  WHERE public.is_current_user_admin()
    AND (
      search_text IS NULL OR search_text = ''
      OR p.nickname ILIKE '%' || search_text || '%'
      OR p.user_id::text ILIKE '%' || search_text || '%'
      OR p.department ILIKE '%' || search_text || '%'
      OR COALESCE(p.degree, '') ILIKE '%' || search_text || '%'
      OR COALESCE(p.major, '') ILIKE '%' || search_text || '%'
      OR u.email ILIKE '%' || search_text || '%'
    )
    AND (
      ban_filter IS NULL OR ban_filter = '' OR ban_filter = 'all'
      OR (ban_filter = 'restricted' AND ar.restriction_type IS NOT NULL)
      OR (ban_filter = 'none' AND ar.restriction_type IS NULL)
    )
  GROUP BY p.user_id, p.nickname, p.avatar_url, p.department, p.degree, p.grade, p.major, u.email, p.created_at, u.last_sign_in_at, ar.restriction_type
  ORDER BY p.created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_user_email(
  target_user_id UUID,
  reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_email TEXT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  IF reason IS NULL OR LENGTH(TRIM(reason)) < 3 THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  SELECT email INTO target_email
  FROM auth.users
  WHERE id = target_user_id;

  PERFORM public.admin_log_action(
    'reveal_user_email',
    'user',
    target_user_id::text,
    reason,
    jsonb_build_object('masked_email', public.mask_email(target_email))
  );

  RETURN target_email;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_action_logs' AND policyname = 'Admins can read logs') THEN
    CREATE POLICY "Admins can read logs" ON public.admin_action_logs FOR SELECT USING (public.is_current_user_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_action_logs' AND policyname = 'Admins can insert logs') THEN
    CREATE POLICY "Admins can insert logs" ON public.admin_action_logs FOR INSERT WITH CHECK (public.is_current_user_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'Admins can manage reports') THEN
    CREATE POLICY "Admins can manage reports" ON public.reports FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inquiries' AND policyname = 'Admins can manage inquiries') THEN
    CREATE POLICY "Admins can manage inquiries" ON public.inquiries FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_restrictions' AND policyname = 'Admins can manage restrictions') THEN
    CREATE POLICY "Admins can manage restrictions" ON public.user_restrictions FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'item_moderation_flags' AND policyname = 'Admins can manage item flags') THEN
    CREATE POLICY "Admins can manage item flags" ON public.item_moderation_flags FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.mask_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_action(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
