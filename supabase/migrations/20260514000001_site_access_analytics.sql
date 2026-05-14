CREATE TABLE IF NOT EXISTS public.site_access_hourly_visitors (
  access_hour TIMESTAMPTZ NOT NULL,
  visitor_hash TEXT NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (access_hour, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_site_access_hourly_visitors_hour
ON public.site_access_hourly_visitors(access_hour DESC);

CREATE INDEX IF NOT EXISTS idx_site_access_hourly_visitors_hash
ON public.site_access_hourly_visitors(visitor_hash);

CREATE TABLE IF NOT EXISTS public.site_access_daily (
  access_date DATE PRIMARY KEY,
  view_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.site_access_hourly_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_access_daily ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.site_access_hourly_visitors TO authenticated;
GRANT SELECT ON public.site_access_daily TO authenticated;

CREATE OR REPLACE FUNCTION public.increment_site_access(
  target_visitor_hash TEXT,
  target_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hour_start TIMESTAMPTZ := DATE_TRUNC('hour', target_time);
BEGIN
  IF target_visitor_hash IS NULL OR LENGTH(TRIM(target_visitor_hash)) < 16 THEN
    RETURN;
  END IF;

  INSERT INTO public.site_access_hourly_visitors(access_hour, visitor_hash, view_count, first_seen_at, last_seen_at)
  VALUES (hour_start, target_visitor_hash, 1, NOW(), NOW())
  ON CONFLICT (access_hour, visitor_hash)
  DO UPDATE SET
    view_count = public.site_access_hourly_visitors.view_count + 1,
    last_seen_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_site_access(target_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_access_daily(access_date, view_count, created_at, updated_at)
  VALUES (target_date, 1, NOW(), NOW())
  ON CONFLICT (access_date)
  DO UPDATE SET
    view_count = public.site_access_daily.view_count + 1,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_today_access_count()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_count BIGINT;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  SELECT COUNT(DISTINCT visitor_hash)
  INTO result_count
  FROM public.site_access_hourly_visitors
  WHERE (access_hour AT TIME ZONE 'Asia/Tokyo')::date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date;

  RETURN COALESCE(result_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_access_stats()
RETURNS TABLE (
  period TEXT,
  bucket_start TIMESTAMPTZ,
  bucket_label TEXT,
  visitor_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  RETURN QUERY
  WITH
  hour_buckets AS (
    SELECT GENERATE_SERIES(
      DATE_TRUNC('hour', NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '23 hours',
      DATE_TRUNC('hour', NOW() AT TIME ZONE 'Asia/Tokyo'),
      INTERVAL '1 hour'
    ) AS bucket
  ),
  day_buckets AS (
    SELECT GENERATE_SERIES(
      ((NOW() AT TIME ZONE 'Asia/Tokyo')::date - 13)::timestamp,
      (NOW() AT TIME ZONE 'Asia/Tokyo')::date::timestamp,
      INTERVAL '1 day'
    ) AS bucket
  ),
  week_buckets AS (
    SELECT GENERATE_SERIES(
      DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '7 weeks',
      DATE_TRUNC('week', NOW() AT TIME ZONE 'Asia/Tokyo'),
      INTERVAL '1 week'
    ) AS bucket
  ),
  month_buckets AS (
    SELECT GENERATE_SERIES(
      DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '11 months',
      DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Tokyo'),
      INTERVAL '1 month'
    ) AS bucket
  )
  SELECT
    'hour'::TEXT AS period,
    (hb.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
    TO_CHAR(hb.bucket, 'MM/DD HH24:00') AS bucket_label,
    COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count
  FROM hour_buckets hb
  LEFT JOIN public.site_access_hourly_visitors sav
    ON DATE_TRUNC('hour', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = hb.bucket
  GROUP BY hb.bucket

  UNION ALL

  SELECT
    'day'::TEXT AS period,
    (db.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
    TO_CHAR(db.bucket, 'MM/DD') AS bucket_label,
    COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count
  FROM day_buckets db
  LEFT JOIN public.site_access_hourly_visitors sav
    ON (sav.access_hour AT TIME ZONE 'Asia/Tokyo')::date = db.bucket::date
  GROUP BY db.bucket

  UNION ALL

  SELECT
    'week'::TEXT AS period,
    (wb.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
    TO_CHAR(wb.bucket, 'MM/DD') AS bucket_label,
    COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count
  FROM week_buckets wb
  LEFT JOIN public.site_access_hourly_visitors sav
    ON DATE_TRUNC('week', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = wb.bucket
  GROUP BY wb.bucket

  UNION ALL

  SELECT
    'month'::TEXT AS period,
    (mb.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
    TO_CHAR(mb.bucket, 'YYYY/MM') AS bucket_label,
    COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count
  FROM month_buckets mb
  LEFT JOIN public.site_access_hourly_visitors sav
    ON DATE_TRUNC('month', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = mb.bucket
  GROUP BY mb.bucket
  ORDER BY period, bucket_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_access_buckets(
  target_period TEXT DEFAULT 'month',
  center_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  period TEXT,
  bucket_start TIMESTAMPTZ,
  bucket_label TEXT,
  visitor_count BIGINT,
  is_future BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jst_now TIMESTAMP := NOW() AT TIME ZONE 'Asia/Tokyo';
  center_jst TIMESTAMP := COALESCE(center_start AT TIME ZONE 'Asia/Tokyo', NOW() AT TIME ZONE 'Asia/Tokyo');
  start_jst TIMESTAMP;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin permission required';
  END IF;

  IF target_period = 'month' THEN
    start_jst := DATE_TRUNC('year', center_jst);

    RETURN QUERY
    WITH buckets AS (
      SELECT GENERATE_SERIES(start_jst, start_jst + INTERVAL '11 months', INTERVAL '1 month') AS bucket
    )
    SELECT
      'month'::TEXT AS period,
      (b.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
      TO_CHAR(b.bucket, 'FMMonth') AS bucket_label,
      COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count,
      (b.bucket > DATE_TRUNC('month', jst_now)) AS is_future
    FROM buckets b
    LEFT JOIN public.site_access_hourly_visitors sav
      ON DATE_TRUNC('month', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = b.bucket
    GROUP BY b.bucket
    ORDER BY b.bucket;

  ELSIF target_period = 'week' THEN
    start_jst := DATE_TRUNC('week', DATE_TRUNC('month', center_jst)) - INTERVAL '2 weeks';

    RETURN QUERY
    WITH buckets AS (
      SELECT GENERATE_SERIES(start_jst, start_jst + INTERVAL '7 weeks', INTERVAL '1 week') AS bucket
    )
    SELECT
      'week'::TEXT AS period,
      (b.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
      TO_CHAR(b.bucket, 'FMMM') || '月第' || (((EXTRACT(DAY FROM b.bucket)::INT - 1) / 7) + 1)::TEXT || '週' AS bucket_label,
      COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count,
      (b.bucket > DATE_TRUNC('week', jst_now)) AS is_future
    FROM buckets b
    LEFT JOIN public.site_access_hourly_visitors sav
      ON DATE_TRUNC('week', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = b.bucket
    GROUP BY b.bucket
    ORDER BY b.bucket;

  ELSIF target_period = 'day' THEN
    start_jst := DATE_TRUNC('week', center_jst);

    RETURN QUERY
    WITH buckets AS (
      SELECT GENERATE_SERIES(start_jst, start_jst + INTERVAL '6 days', INTERVAL '1 day') AS bucket
    )
    SELECT
      'day'::TEXT AS period,
      (b.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
      TO_CHAR(b.bucket, 'FMMM/FMDD') AS bucket_label,
      COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count,
      (b.bucket::date > jst_now::date) AS is_future
    FROM buckets b
    LEFT JOIN public.site_access_hourly_visitors sav
      ON (sav.access_hour AT TIME ZONE 'Asia/Tokyo')::date = b.bucket::date
    GROUP BY b.bucket
    ORDER BY b.bucket;

  ELSIF target_period = 'hour' THEN
    IF EXTRACT(HOUR FROM center_jst) = 0
       AND EXTRACT(MINUTE FROM center_jst) = 0
       AND EXTRACT(SECOND FROM center_jst) = 0 THEN
      start_jst := DATE_TRUNC('day', center_jst) + INTERVAL '8 hours';
    ELSE
      start_jst := DATE_TRUNC('hour', center_jst) - INTERVAL '3 hours';
    END IF;

    RETURN QUERY
    WITH buckets AS (
      SELECT GENERATE_SERIES(start_jst, start_jst + INTERVAL '7 hours', INTERVAL '1 hour') AS bucket
    )
    SELECT
      'hour'::TEXT AS period,
      (b.bucket AT TIME ZONE 'Asia/Tokyo') AS bucket_start,
      TO_CHAR(b.bucket, 'HH24:00') AS bucket_label,
      COUNT(DISTINCT sav.visitor_hash)::BIGINT AS visitor_count,
      (b.bucket > DATE_TRUNC('hour', jst_now)) AS is_future
    FROM buckets b
    LEFT JOIN public.site_access_hourly_visitors sav
      ON DATE_TRUNC('hour', sav.access_hour AT TIME ZONE 'Asia/Tokyo') = b.bucket
    GROUP BY b.bucket
    ORDER BY b.bucket;

  ELSE
    RAISE EXCEPTION 'unsupported access period: %', target_period;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_access_hourly_visitors'
      AND policyname = 'Admins can read hourly access visitors'
  ) THEN
    CREATE POLICY "Admins can read hourly access visitors"
    ON public.site_access_hourly_visitors
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'site_access_daily'
      AND policyname = 'Admins can read site access daily'
  ) THEN
    CREATE POLICY "Admins can read site access daily"
    ON public.site_access_daily
    FOR SELECT
    USING (public.is_current_user_admin());
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.increment_site_access(TEXT, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_site_access(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_today_access_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_access_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_access_buckets(TEXT, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
