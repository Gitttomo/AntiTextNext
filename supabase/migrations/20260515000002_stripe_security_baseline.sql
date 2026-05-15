CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
ON public.login_attempts(LOWER(email), attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
ON public.login_attempts(ip_address, attempted_at DESC);

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope, key, window_start)
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_lookup
ON public.api_rate_limits(scope, key, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received
ON public.stripe_webhook_events(received_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_action_logs
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

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
  safe_metadata JSONB := COALESCE(metadata, '{}'::jsonb);
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  INSERT INTO public.admin_action_logs(
    admin_user_id,
    action_type,
    target_type,
    target_id,
    reason,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    auth.uid(),
    action_type,
    target_type,
    target_id,
    reason,
    safe_metadata,
    NULLIF(safe_metadata->>'ip_address', ''),
    NULLIF(safe_metadata->>'user_agent', '')
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_login_rate_limited(
  target_email TEXT,
  target_ip_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email TEXT := LOWER(TRIM(COALESCE(target_email, '')));
  failed_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO failed_count
  FROM public.login_attempts
  WHERE success = FALSE
    AND attempted_at > NOW() - INTERVAL '15 minutes'
    AND (
      (normalized_email <> '' AND LOWER(email) = normalized_email)
      OR (target_ip_address IS NOT NULL AND target_ip_address <> '' AND ip_address = target_ip_address)
    );

  RETURN failed_count >= 8;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_login_attempt(
  target_email TEXT,
  target_ip_address TEXT,
  target_user_agent TEXT,
  was_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts(email, ip_address, user_agent, success, attempted_at)
  VALUES (
    NULLIF(LOWER(TRIM(COALESCE(target_email, ''))), ''),
    NULLIF(TRIM(COALESCE(target_ip_address, '')), ''),
    LEFT(COALESCE(target_user_agent, ''), 500),
    was_success,
    NOW()
  );

  DELETE FROM public.login_attempts
  WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  rate_scope TEXT,
  rate_key TEXT,
  max_requests INTEGER,
  window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_scope TEXT := NULLIF(TRIM(COALESCE(rate_scope, '')), '');
  normalized_key TEXT := NULLIF(TRIM(COALESCE(rate_key, '')), '');
  normalized_window_seconds INTEGER := GREATEST(COALESCE(window_seconds, 60), 1);
  window_epoch BIGINT;
  window_start_time TIMESTAMPTZ;
  current_count INTEGER;
BEGIN
  IF normalized_scope IS NULL OR normalized_key IS NULL THEN
    RETURN FALSE;
  END IF;

  window_epoch := FLOOR(EXTRACT(EPOCH FROM NOW()) / normalized_window_seconds) * normalized_window_seconds;
  window_start_time := TO_TIMESTAMP(window_epoch);

  INSERT INTO public.api_rate_limits(scope, key, window_start, count, updated_at)
  VALUES (normalized_scope, normalized_key, window_start_time, 1, NOW())
  ON CONFLICT (scope, key, window_start)
  DO UPDATE SET
    count = public.api_rate_limits.count + 1,
    updated_at = NOW()
  RETURNING count INTO current_count;

  DELETE FROM public.api_rate_limits
  WHERE window_start < NOW() - INTERVAL '7 days';

  RETURN current_count <= max_requests;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stripe_webhook_event(
  target_event_id TEXT,
  target_event_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF target_event_id IS NULL OR TRIM(target_event_id) = '' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.stripe_webhook_events(event_id, event_type, received_at)
  VALUES (TRIM(target_event_id), COALESCE(NULLIF(TRIM(target_event_type), ''), 'unknown'), NOW())
  ON CONFLICT (event_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_stripe_webhook_event_processed(
  target_event_id TEXT,
  target_processing_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stripe_webhook_events
  SET
    processed_at = NOW(),
    processing_error = NULLIF(LEFT(COALESCE(target_processing_error, ''), 1000), '')
  WHERE event_id = target_event_id;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'login_attempts'
      AND policyname = 'Admins can read login attempts'
  ) THEN
    CREATE POLICY "Admins can read login attempts"
    ON public.login_attempts
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_rate_limits'
      AND policyname = 'Admins can read api rate limits'
  ) THEN
    CREATE POLICY "Admins can read api rate limits"
    ON public.api_rate_limits
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'stripe_webhook_events'
      AND policyname = 'Admins can read stripe webhook events'
  ) THEN
    CREATE POLICY "Admins can read stripe webhook events"
    ON public.stripe_webhook_events
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;
END $$;

GRANT SELECT ON public.login_attempts TO authenticated;
GRANT SELECT ON public.api_rate_limits TO authenticated;
GRANT SELECT ON public.stripe_webhook_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_action(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_login_rate_limited(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_webhook_event(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stripe_webhook_event_processed(TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
