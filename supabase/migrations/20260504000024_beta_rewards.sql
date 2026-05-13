CREATE TABLE IF NOT EXISTS public.reward_settings (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_type TEXT NOT NULL,
  label TEXT NOT NULL,
  note TEXT,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_reward_overrides (
  user_id UUID PRIMARY KEY,
  early_registration_override TEXT NOT NULL DEFAULT 'auto'
    CHECK (early_registration_override IN ('auto', 'force_on', 'force_off')),
  note TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.reward_settings(id, enabled, starts_at, ends_at)
VALUES (
  'early_registration',
  TRUE,
  '2026-05-01 00:00:00+09',
  '2026-06-09 23:59:59+09'
)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_badges_user_active
ON public.user_badges(user_id, revoked_at);

ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reward_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.reward_settings TO anon, authenticated;
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT INSERT, UPDATE ON public.reward_settings TO authenticated;
GRANT INSERT, UPDATE ON public.user_badges TO authenticated;
GRANT SELECT ON public.user_reward_overrides TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_reward_overrides TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_settings' AND policyname = 'Anyone can read reward settings') THEN
    CREATE POLICY "Anyone can read reward settings" ON public.reward_settings FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reward_settings' AND policyname = 'Admins can manage reward settings') THEN
    CREATE POLICY "Admins can manage reward settings" ON public.reward_settings FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_badges' AND policyname = 'Anyone can read active badges') THEN
    CREATE POLICY "Anyone can read active badges" ON public.user_badges FOR SELECT USING (revoked_at IS NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_badges' AND policyname = 'Admins can manage user badges') THEN
    CREATE POLICY "Admins can manage user badges" ON public.user_badges FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reward_overrides' AND policyname = 'Anyone can read reward overrides') THEN
    CREATE POLICY "Anyone can read reward overrides" ON public.user_reward_overrides FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_reward_overrides' AND policyname = 'Admins can manage reward overrides') THEN
    CREATE POLICY "Admins can manage reward overrides" ON public.user_reward_overrides FOR ALL USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
