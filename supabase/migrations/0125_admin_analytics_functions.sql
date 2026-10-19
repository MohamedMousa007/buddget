-- Aggregation for the admin portal. Server-only (service_role): they read auth.users and bypass RLS.

CREATE OR REPLACE FUNCTION public.admin_overview() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT jsonb_build_object(
    'users_total',  (SELECT count(*) FROM auth.users),
    'users_new_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_prev_7d',(SELECT count(*) FROM auth.users WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'),
    'users_new_30d',(SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'users_banned', (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()),
    'dau', (SELECT count(DISTINCT user_id) FROM app_analytics_events WHERE created_at > now() - interval '1 day'),
    'wau', (SELECT count(DISTINCT user_id) FROM app_analytics_events WHERE created_at > now() - interval '7 days'),
    'mau', (SELECT count(DISTINCT user_id) FROM app_analytics_events WHERE created_at > now() - interval '30 days'),
    'expenses_total',    (SELECT count(*) FROM expenses WHERE deleted_at IS NULL),
    'expenses_7d',       (SELECT count(*) FROM expenses WHERE deleted_at IS NULL AND created_at > now() - interval '7 days'),
    'sms_enabled_users', (SELECT count(*) FROM user_settings WHERE sms_tracking_enabled),
    'push_devices',      (SELECT count(*) FROM push_tokens),
    'platforms', (SELECT COALESCE(jsonb_object_agg(platform, c), '{}'::jsonb)
                  FROM (SELECT COALESCE(platform, 'unknown') AS platform, count(DISTINCT user_id) AS c FROM push_tokens GROUP BY 1) x),
    'sms_24h', (SELECT jsonb_build_object(
                  'total',    count(*),
                  'parsed',   count(*) FILTER (WHERE parsed_ok),
                  'failed',   count(*) FILTER (WHERE status IN ('failed', 'add_failed')),
                  'rejected', count(*) FILTER (WHERE status = 'rejected'),
                  'pending',  count(*) FILTER (WHERE status = 'processing'))
                FROM sms_parse_log WHERE received_at > now() - interval '1 day'),
    'sms_7d', (SELECT jsonb_build_object(
                  'total',    count(*),
                  'parsed',   count(*) FILTER (WHERE parsed_ok),
                  'failed',   count(*) FILTER (WHERE status IN ('failed', 'add_failed')))
                FROM sms_parse_log WHERE received_at > now() - interval '7 days'),
    'tickets', (SELECT jsonb_build_object(
                  'open',    count(*) FILTER (WHERE status = 'open'),
                  'pending', count(*) FILTER (WHERE status = 'pending'),
                  'urgent',  count(*) FILTER (WHERE status IN ('open', 'pending') AND priority = 'urgent'),
                  'unassigned', count(*) FILTER (WHERE status IN ('open', 'pending') AND assignee_id IS NULL))
                FROM support_tickets),
    'plans', (SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', plan_key, 'status', status, 'users', c)), '[]'::jsonb)
              FROM (SELECT plan_key, status, count(*) AS c FROM user_entitlements GROUP BY 1, 2) p)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_signup_series(p_days integer DEFAULT 30) RETURNS TABLE (day date, signups integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT d::date, COALESCE(c.n, 0)::integer
  FROM generate_series((current_date - (LEAST(GREATEST(p_days, 1), 365) - 1))::timestamp, current_date::timestamp, interval '1 day') d
  LEFT JOIN (SELECT created_at::date AS day, count(*) AS n FROM auth.users GROUP BY 1) c ON c.day = d::date
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_activity_series(p_days integer DEFAULT 30)
RETURNS TABLE (day date, active_users integer, sessions integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT d::date, COALESCE(a.users, 0)::integer, COALESCE(a.sessions, 0)::integer
  FROM generate_series((current_date - (LEAST(GREATEST(p_days, 1), 365) - 1))::timestamp, current_date::timestamp, interval '1 day') d
  LEFT JOIN (
    SELECT created_at::date AS day, count(DISTINCT user_id) AS users, count(*) FILTER (WHERE event_type = 'session_start') AS sessions
    FROM app_analytics_events GROUP BY 1
  ) a ON a.day = d::date
  ORDER BY 1;
$$;

-- Distinct users with at least one live row per product area, plus the activation funnel.
CREATE OR REPLACE FUNCTION public.admin_feature_adoption() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT jsonb_build_object(
    'total_users',   (SELECT count(*) FROM auth.users),
    'expenses',      (SELECT count(DISTINCT user_id) FROM expenses WHERE deleted_at IS NULL),
    'income',        (SELECT count(DISTINCT user_id) FROM income_sources WHERE deleted_at IS NULL),
    'budgets',       (SELECT count(DISTINCT user_id) FROM budget_plans WHERE deleted_at IS NULL),
    'debts',         (SELECT count(DISTINCT user_id) FROM debts WHERE deleted_at IS NULL),
    'subscriptions', (SELECT count(DISTINCT user_id) FROM subscriptions WHERE deleted_at IS NULL),
    'goals',         (SELECT count(DISTINCT user_id) FROM goals WHERE deleted_at IS NULL),
    'savings',       (SELECT count(DISTINCT user_id) FROM savings_accounts WHERE deleted_at IS NULL),
    'receipts',      (SELECT count(DISTINCT user_id) FROM receipts WHERE deleted_at IS NULL),
    'sms',           (SELECT count(DISTINCT user_id) FROM sms_parse_log WHERE parsed_ok),
    'push',          (SELECT count(DISTINCT user_id) FROM push_tokens),
    'biometric',     (SELECT count(DISTINCT user_id) FROM biometric_devices),
    'two_factor',    (SELECT count(*) FROM user_settings WHERE two_factor_email_enabled),
    'ai_enabled',    (SELECT count(*) FROM user_settings WHERE enable_ai)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_retention(p_weeks integer DEFAULT 8) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  WITH weeks AS (
    SELECT generate_series(0, LEAST(GREATEST(p_weeks, 2), 26) - 1) AS n
  ), cohorts AS (
    SELECT date_trunc('week', now() - (n || ' weeks')::interval)::date AS cohort_week, n FROM weeks
  ), members AS (
    SELECT c.cohort_week, u.id
    FROM cohorts c JOIN auth.users u ON date_trunc('week', u.created_at)::date = c.cohort_week
  ), activity AS (
    SELECT DISTINCT user_id, date_trunc('week', created_at)::date AS wk FROM app_analytics_events
  ), grid AS (
    SELECT m.cohort_week, ((a.wk - m.cohort_week) / 7) AS offset_wk, count(DISTINCT m.id) AS active
    FROM members m JOIN activity a ON a.user_id = m.id AND a.wk >= m.cohort_week
    GROUP BY 1, 2
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cohort_week', c.cohort_week,
    'size', (SELECT count(*) FROM members m WHERE m.cohort_week = c.cohort_week),
    'active', (SELECT COALESCE(jsonb_object_agg(g.offset_wk, g.active), '{}'::jsonb) FROM grid g WHERE g.cohort_week = c.cohort_week)
  ) ORDER BY c.cohort_week), '[]'::jsonb)
  FROM cohorts c;
$$;

CREATE OR REPLACE FUNCTION public.admin_sms_health(p_days integer DEFAULT 7) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH w AS (
    SELECT * FROM sms_parse_log WHERE received_at > now() - (LEAST(GREATEST(p_days, 1), 90) || ' days')::interval
  )
  SELECT jsonb_build_object(
    'total',  (SELECT count(*) FROM w),
    'parsed', (SELECT count(*) FROM w WHERE parsed_ok),
    'failed', (SELECT count(*) FROM w WHERE status IN ('failed', 'add_failed')),
    'rejected', (SELECT count(*) FROM w WHERE status = 'rejected'),
    'undelivered', (SELECT count(*) FROM w WHERE status IN ('logged', 'notified') AND received_at < now() - interval '2 minutes'),
    'users', (SELECT count(DISTINCT user_id) FROM w),
    'by_method', (SELECT COALESCE(jsonb_object_agg(m, c), '{}'::jsonb) FROM (SELECT COALESCE(parse_method, 'none') AS m, count(*) AS c FROM w GROUP BY 1) x),
    'by_status', (SELECT COALESCE(jsonb_object_agg(status, c), '{}'::jsonb) FROM (SELECT COALESCE(status, 'unknown') AS status, count(*) AS c FROM w GROUP BY 1) x),
    'failure_codes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'count', c) ORDER BY c DESC), '[]'::jsonb)
                      FROM (SELECT failure_code AS code, count(*) AS c FROM w WHERE failure_code IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 10) x),
    'top_failing_senders', (SELECT COALESCE(jsonb_agg(jsonb_build_object('sender', sender, 'failed', f, 'total', t) ORDER BY f DESC), '[]'::jsonb)
                      FROM (SELECT sender, count(*) FILTER (WHERE NOT parsed_ok AND status <> 'rejected') AS f, count(*) AS t
                            FROM w WHERE sender IS NOT NULL GROUP BY 1 HAVING count(*) FILTER (WHERE NOT parsed_ok AND status <> 'rejected') > 0
                            ORDER BY 2 DESC LIMIT 10) x),
    'daily', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'total', t, 'parsed', p, 'failed', f) ORDER BY day), '[]'::jsonb)
              FROM (SELECT received_at::date AS day, count(*) AS t, count(*) FILTER (WHERE parsed_ok) AS p,
                           count(*) FILTER (WHERE status IN ('failed', 'add_failed')) AS f FROM w GROUP BY 1) x)
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_user_directory(
  p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_order text DEFAULT 'created_desc', p_plan text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE result jsonb; q text := NULLIF(btrim(p_search), '');
BEGIN
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
  ), filtered AS (
    SELECT * FROM base
    WHERE (p_plan IS NULL OR plan_key = p_plan)
      AND (p_state IS NULL
        OR (p_state = 'banned' AND banned_until IS NOT NULL AND banned_until > now())
        OR (p_state = 'unconfirmed' AND NOT confirmed)
        OR (p_state = 'sms' AND sms_enabled)
        OR (p_state = 'inactive' AND (last_active_at IS NULL OR last_active_at < now() - interval '30 days')))
  ), page AS (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_order = 'created_asc'  THEN created_at END ASC,
      CASE WHEN p_order = 'active_desc'  THEN last_active_at END DESC NULLS LAST,
      CASE WHEN p_order = 'expenses_desc' THEN expenses END DESC,
      CASE WHEN p_order = 'email_asc'    THEN email END ASC,
      created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 200) OFFSET GREATEST(p_offset, 0)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_overview(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT jsonb_build_object(
    'auth', (SELECT jsonb_build_object(
               'id', u.id, 'email', u.email, 'phone', u.phone, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
               'email_confirmed_at', u.email_confirmed_at, 'banned_until', u.banned_until,
               'providers', COALESCE((SELECT jsonb_agg(DISTINCT i.provider) FROM auth.identities i WHERE i.user_id = u.id), '[]'::jsonb))
             FROM auth.users u WHERE u.id = p_user),
    'profile', (SELECT jsonb_build_object(
               'name', COALESCE(p.display_name, p.name), 'city', p.city, 'country', p.country,
               'base_currency', p.base_currency, 'secondary_currency', p.secondary_currency, 'phone', p.phone, 'created_at', p.created_at)
             FROM profiles p WHERE p.id = p_user),
    'settings', (SELECT jsonb_build_object(
               'language', s.language, 'theme', s.theme, 'enable_ai', s.enable_ai, 'sms_tracking_enabled', s.sms_tracking_enabled,
               'two_factor_email_enabled', s.two_factor_email_enabled, 'month_start_day', s.month_start_day)
             FROM user_settings s WHERE s.user_id = p_user),
    'counts', jsonb_build_object(
      'expenses',      (SELECT count(*) FROM expenses WHERE user_id = p_user AND deleted_at IS NULL),
      'income_sources',(SELECT count(*) FROM income_sources WHERE user_id = p_user AND deleted_at IS NULL),
      'budget_plans',  (SELECT count(*) FROM budget_plans WHERE user_id = p_user AND deleted_at IS NULL),
      'debts',         (SELECT count(*) FROM debts WHERE user_id = p_user AND deleted_at IS NULL),
      'subscriptions', (SELECT count(*) FROM subscriptions WHERE user_id = p_user AND deleted_at IS NULL),
      'goals',         (SELECT count(*) FROM goals WHERE user_id = p_user AND deleted_at IS NULL),
      'savings',       (SELECT count(*) FROM savings_accounts WHERE user_id = p_user AND deleted_at IS NULL),
      'receipts',      (SELECT count(*) FROM receipts WHERE user_id = p_user AND deleted_at IS NULL),
      'sms_total',     (SELECT count(*) FROM sms_parse_log WHERE user_id = p_user),
      'sms_failed',    (SELECT count(*) FROM sms_parse_log WHERE user_id = p_user AND status IN ('failed', 'add_failed')),
      'notifications_unread', (SELECT count(*) FROM notifications WHERE user_id = p_user AND NOT is_read),
      'tickets',       (SELECT count(*) FROM support_tickets WHERE user_id = p_user)),
    'devices', jsonb_build_object(
      'push', COALESCE((SELECT jsonb_agg(jsonb_build_object('platform', platform, 'app_version', app_version, 'device_model', device_model, 'locale', locale, 'updated_at', updated_at) ORDER BY updated_at DESC)
                        FROM push_tokens WHERE user_id = p_user), '[]'::jsonb),
      'sms_tokens_active', (SELECT count(*) FROM sms_ingest_tokens WHERE user_id = p_user AND is_active),
      'trusted', (SELECT count(*) FROM trusted_devices WHERE user_id = p_user),
      'biometric', (SELECT count(*) FROM biometric_devices WHERE user_id = p_user)),
    'activity', jsonb_build_object(
      'last_event_at', (SELECT max(created_at) FROM app_analytics_events WHERE user_id = p_user),
      'sessions_30d', (SELECT count(*) FROM app_analytics_events WHERE user_id = p_user AND event_type = 'session_start' AND created_at > now() - interval '30 days'),
      'active_days_30d', (SELECT count(DISTINCT created_at::date) FROM app_analytics_events WHERE user_id = p_user AND created_at > now() - interval '30 days')),
    'entitlement', (SELECT to_jsonb(e) FROM user_entitlements e WHERE e.user_id = p_user),
    'loyalty', (SELECT to_jsonb(l) FROM loyalty_accounts l WHERE l.user_id = p_user)
  );
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_overview()', 'admin_signup_series(integer)', 'admin_activity_series(integer)', 'admin_feature_adoption()',
    'admin_retention(integer)', 'admin_sms_health(integer)',
    'admin_user_directory(text,integer,integer,text,text,text)', 'admin_user_overview(uuid)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
