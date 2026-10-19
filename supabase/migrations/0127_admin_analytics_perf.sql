-- Performance pass for the admin analytics functions, measured against 50k users / 1.5M events:
--  * admin_retention took ~17s: it de-duplicated every event ever recorded before joining. It now only reads the events of
--    users in the cohort window, through the (user_id, created_at) index.
--  * admin_activity_series grouped the whole events table on every call: now bounded to the requested window.
--  * admin_user_directory computed per-user aggregates for every user before paging. For the default sorts it now pages
--    on cheap columns first and aggregates only the page.
--  * a BRIN index on events.created_at (append-only, tiny) serves the DAU/WAU/MAU and windowed scans.
CREATE INDEX IF NOT EXISTS app_analytics_events_created_brin ON public.app_analytics_events USING brin (created_at);

CREATE OR REPLACE FUNCTION public.admin_activity_series(p_days integer DEFAULT 30)
RETURNS TABLE (day date, active_users integer, sessions integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH w AS (SELECT LEAST(GREATEST(p_days, 1), 365) AS n)
  SELECT d::date, COALESCE(a.users, 0)::integer, COALESCE(a.sessions, 0)::integer
  FROM w, generate_series((current_date - (w.n - 1))::timestamp, current_date::timestamp, interval '1 day') d
  LEFT JOIN (
    SELECT created_at::date AS day, count(DISTINCT user_id) AS users, count(*) FILTER (WHERE event_type = 'session_start') AS sessions
    FROM app_analytics_events, w
    WHERE created_at >= (current_date - (w.n - 1))::timestamp
    GROUP BY 1
  ) a ON a.day = d::date
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_retention(p_weeks integer DEFAULT 8) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  WITH w AS (SELECT LEAST(GREATEST(p_weeks, 2), 26) AS n),
  cohorts AS (
    SELECT date_trunc('week', now() - (g || ' weeks')::interval)::date AS cohort_week
    FROM w, generate_series(0, w.n - 1) g
  ), members AS (
    SELECT u.id, date_trunc('week', u.created_at)::date AS cohort_week
    FROM auth.users u
    WHERE u.created_at >= (SELECT min(cohort_week) FROM cohorts)
  ), activity AS (
    SELECT DISTINCT e.user_id, date_trunc('week', e.created_at)::date AS wk
    FROM members m JOIN app_analytics_events e ON e.user_id = m.id AND e.created_at >= m.cohort_week
  ), grid AS (
    SELECT m.cohort_week, ((a.wk - m.cohort_week) / 7) AS offset_wk, count(*) AS active
    FROM members m JOIN activity a ON a.user_id = m.id
    GROUP BY 1, 2
  ), sizes AS (
    SELECT cohort_week, count(*) AS size FROM members GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cohort_week', c.cohort_week,
    'size', COALESCE(s.size, 0),
    'active', (SELECT COALESCE(jsonb_object_agg(g.offset_wk, g.active), '{}'::jsonb) FROM grid g WHERE g.cohort_week = c.cohort_week)
  ) ORDER BY c.cohort_week), '[]'::jsonb)
  FROM cohorts c LEFT JOIN sizes s ON s.cohort_week = c.cohort_week;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_directory(
  p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_order text DEFAULT 'created_desc', p_plan text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  result jsonb;
  q text := NULLIF(btrim(p_search), '');
  lim integer := LEAST(GREATEST(p_limit, 1), 200);
  off integer := GREATEST(p_offset, 0);
BEGIN
  IF p_order IN ('active_desc', 'expenses_desc') OR p_state = 'inactive' THEN
    -- Sorting or filtering needs the aggregates for everyone.
    WITH base AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(p.display_name, p.name) AS name, p.country, p.base_currency::text AS currency,
             COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) AS plan_key,
             COALESCE(e.status, 'active') AS plan_status,
             (SELECT max(created_at) FROM app_analytics_events a WHERE a.user_id = u.id) AS last_active_at,
             (SELECT count(*) FROM expenses x WHERE x.user_id = u.id AND x.deleted_at IS NULL) AS expenses,
             COALESCE(s.sms_tracking_enabled, false) AS sms_enabled,
             (SELECT string_agg(DISTINCT t.platform, ',') FROM push_tokens t WHERE t.user_id = u.id) AS platforms
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_entitlements e ON e.user_id = u.id
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE (q IS NULL OR u.email ILIKE '%' || q || '%' OR p.name ILIKE '%' || q || '%' OR p.display_name ILIKE '%' || q || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
    ), filtered AS (
      SELECT * FROM base
      WHERE (p_state IS NULL
        OR (p_state = 'banned' AND banned_until IS NOT NULL AND banned_until > now())
        OR (p_state = 'unconfirmed' AND NOT confirmed)
        OR (p_state = 'sms' AND sms_enabled)
        OR (p_state = 'inactive' AND (last_active_at IS NULL OR last_active_at < now() - interval '30 days')))
    ), page AS (
      SELECT * FROM filtered
      ORDER BY
        CASE WHEN p_order = 'active_desc'   THEN last_active_at END DESC NULLS LAST,
        CASE WHEN p_order = 'expenses_desc' THEN expenses END DESC,
        CASE WHEN p_order = 'created_asc'   THEN created_at END ASC,
        CASE WHEN p_order = 'email_asc'     THEN email END ASC,
        created_at DESC
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)
    ) INTO result;
  ELSE
    -- Cheap path: filter, count and page on plain columns, then aggregate only the rows shown.
    WITH cheap AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(p.display_name, p.name) AS name, p.country, p.base_currency::text AS currency,
             COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) AS plan_key,
             COALESCE(e.status, 'active') AS plan_status,
             COALESCE(s.sms_tracking_enabled, false) AS sms_enabled
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_entitlements e ON e.user_id = u.id
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE (q IS NULL OR u.email ILIKE '%' || q || '%' OR p.name ILIKE '%' || q || '%' OR p.display_name ILIKE '%' || q || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
        AND (p_state IS NULL
          OR (p_state = 'banned' AND u.banned_until IS NOT NULL AND u.banned_until > now())
          OR (p_state = 'unconfirmed' AND u.email_confirmed_at IS NULL)
          OR (p_state = 'sms' AND COALESCE(s.sms_tracking_enabled, false)))
    ), page AS (
      SELECT *, row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'created_asc' THEN created_at END ASC,
          CASE WHEN p_order = 'email_asc'   THEN email END ASC,
          created_at DESC
      ) AS rn
      FROM cheap
      ORDER BY rn
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM cheap),
      'rows', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) - 'rn' ORDER BY r.rn)
        FROM (
          SELECT page.*,
                 (SELECT max(a.created_at) FROM app_analytics_events a WHERE a.user_id = page.id) AS last_active_at,
                 (SELECT count(*) FROM expenses x WHERE x.user_id = page.id AND x.deleted_at IS NULL) AS expenses,
                 (SELECT string_agg(DISTINCT t.platform, ',') FROM push_tokens t WHERE t.user_id = page.id) AS platforms
          FROM page
        ) r
      ), '[]'::jsonb)
    ) INTO result;
  END IF;
  RETURN result;
END $$;
