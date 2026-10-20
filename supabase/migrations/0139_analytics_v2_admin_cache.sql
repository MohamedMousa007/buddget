-- Analytics v2 and the admin metrics cache (scaling plan phases 1 and 4).
--  * Clients report activity as ONE small upsert per user per day (analytics_touch) instead of one row per heartbeat.
--  * Old clients' raw events are rolled into the same daily table once their day is closed, then deleted (each exactly once).
--  * Admin functions read a single view over both, so numbers stay right during the transition.
--  * Heavy admin aggregates are computed on a schedule (pg_cron) into admin_metrics_cache and served from there.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Sums two {"key": count} objects, keeping the 40 largest keys.
CREATE OR REPLACE FUNCTION public.jsonb_counts_add(a jsonb, b jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
    SELECT k, sum(v)::int AS v FROM (
      SELECT key AS k, value::int AS v FROM jsonb_each_text(CASE WHEN jsonb_typeof(a) = 'object' THEN a ELSE '{}'::jsonb END) WHERE value ~ '^[0-9]{1,9}$'
      UNION ALL
      SELECT key, value::int FROM jsonb_each_text(CASE WHEN jsonb_typeof(b) = 'object' THEN b ELSE '{}'::jsonb END) WHERE value ~ '^[0-9]{1,9}$'
    ) s GROUP BY k ORDER BY sum(v) DESC LIMIT 40
  ) t
$$;

-- The client's batched report. Bounded so a bad client cannot inflate numbers.
CREATE OR REPLACE FUNCTION public.analytics_touch(p_seconds integer DEFAULT 0, p_sessions integer DEFAULT 0, p_paths jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  INSERT INTO app_analytics_daily AS d (day, user_id, sessions, visibility_events, heartbeats, active_seconds, first_event_at, last_event_at, paths)
  VALUES ((now() AT TIME ZONE 'UTC')::date, uid, LEAST(GREATEST(COALESCE(p_sessions, 0), 0), 5), 0, 1,
          LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 900), now(), now(), jsonb_counts_add(NULL, p_paths))
  ON CONFLICT (day, user_id) DO UPDATE SET
    sessions       = d.sessions + EXCLUDED.sessions,
    heartbeats     = d.heartbeats + 1,
    active_seconds = d.active_seconds + EXCLUDED.active_seconds,
    last_event_at  = now(),
    paths          = jsonb_counts_add(d.paths, EXCLUDED.paths);
END $$;
REVOKE ALL ON FUNCTION public.analytics_touch(integer, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_touch(integer, integer, jsonb) TO authenticated;

-- One view of activity per user per day: the daily table plus raw events from clients that have not rolled up yet.
CREATE OR REPLACE VIEW public.app_activity_days WITH (security_invoker = true) AS
  SELECT day, user_id, sessions, active_seconds, last_event_at FROM public.app_analytics_daily
  UNION ALL
  SELECT (created_at AT TIME ZONE 'UTC')::date, user_id,
         (count(*) FILTER (WHERE event_type = 'session_start'))::int,
         COALESCE(sum(CASE WHEN event_type = 'heartbeat' AND (metadata->>'seconds') ~ '^[0-9]+$' THEN (metadata->>'seconds')::int END), 0)::int,
         max(created_at)
  FROM public.app_analytics_events WHERE user_id IS NOT NULL GROUP BY 1, 2;
REVOKE ALL ON public.app_activity_days FROM PUBLIC, anon, authenticated;

-- Rolls every closed day of raw events into the daily table and removes those rows, in one statement (exactly once).
CREATE OR REPLACE FUNCTION public.analytics_rollup() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  WITH del AS (
    DELETE FROM app_analytics_events WHERE created_at < date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    RETURNING user_id, event_type, metadata, created_at
  ), per_path AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id, metadata->>'path' AS path, count(*)::int AS c
    FROM del WHERE user_id IS NOT NULL AND metadata->>'path' IS NOT NULL GROUP BY 1, 2, 3
  ), paths AS (
    SELECT day, user_id, jsonb_object_agg(path, c) AS p FROM (SELECT * FROM per_path ORDER BY c DESC) x GROUP BY 1, 2
  ), agg AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id,
           (count(*) FILTER (WHERE event_type = 'session_start'))::int AS sessions,
           (count(*) FILTER (WHERE event_type = 'visibility_visible'))::int AS visibility_events,
           (count(*) FILTER (WHERE event_type = 'heartbeat'))::int AS heartbeats,
           COALESCE(sum(CASE WHEN event_type = 'heartbeat' AND (metadata->>'seconds') ~ '^[0-9]+$' THEN (metadata->>'seconds')::int END), 0)::int AS active_seconds,
           min(created_at) AS first_at, max(created_at) AS last_at
    FROM del WHERE user_id IS NOT NULL GROUP BY 1, 2
  )
  INSERT INTO app_analytics_daily AS d (day, user_id, sessions, visibility_events, heartbeats, active_seconds, first_event_at, last_event_at, paths)
  SELECT a.day, a.user_id, a.sessions, a.visibility_events, a.heartbeats, a.active_seconds, a.first_at, a.last_at, COALESCE(p.p, '{}'::jsonb)
  FROM agg a LEFT JOIN paths p ON p.day = a.day AND p.user_id = a.user_id
  ON CONFLICT (day, user_id) DO UPDATE SET
    sessions = d.sessions + EXCLUDED.sessions, visibility_events = d.visibility_events + EXCLUDED.visibility_events,
    heartbeats = d.heartbeats + EXCLUDED.heartbeats, active_seconds = d.active_seconds + EXCLUDED.active_seconds,
    first_event_at = LEAST(d.first_event_at, EXCLUDED.first_event_at), last_event_at = GREATEST(d.last_event_at, EXCLUDED.last_event_at),
    paths = jsonb_counts_add(d.paths, EXCLUDED.paths);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.analytics_rollup() FROM PUBLIC, anon, authenticated;

-- Admin functions: activity now comes from the view.
CREATE OR REPLACE FUNCTION public.admin_activity_series(p_days integer DEFAULT 30)
RETURNS TABLE(day date, active_users integer, sessions integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH w AS (SELECT LEAST(GREATEST(p_days, 1), 365) AS n)
  SELECT d::date, COALESCE(a.users, 0)::integer, COALESCE(a.sessions, 0)::integer
  FROM w, generate_series((current_date - (w.n - 1))::timestamp, current_date::timestamp, interval '1 day') d
  LEFT JOIN (
    SELECT v.day, count(DISTINCT v.user_id) AS users, sum(v.sessions) AS sessions
    FROM app_activity_days v, w WHERE v.day >= current_date - (w.n - 1) GROUP BY 1
  ) a ON a.day = d::date
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_retention(p_weeks integer DEFAULT 8)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  WITH w AS (SELECT LEAST(GREATEST(p_weeks, 2), 26) AS n),
  cohorts AS (
    SELECT date_trunc('week', now() - (g || ' weeks')::interval)::date AS cohort_week
    FROM w, generate_series(0, w.n - 1) g
  ), members AS (
    SELECT u.id, date_trunc('week', u.created_at)::date AS cohort_week
    FROM auth.users u WHERE u.created_at >= (SELECT min(cohort_week) FROM cohorts)
  ), activity AS (
    SELECT DISTINCT e.user_id, date_trunc('week', e.day)::date AS wk
    FROM members m JOIN app_activity_days e ON e.user_id = m.id AND e.day >= m.cohort_week
  ), grid AS (
    SELECT m.cohort_week, ((a.wk - m.cohort_week) / 7) AS offset_wk, count(*) AS active
    FROM members m JOIN activity a ON a.user_id = m.id GROUP BY 1, 2
  ), sizes AS (SELECT cohort_week, count(*) AS size FROM members GROUP BY 1)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'cohort_week', c.cohort_week, 'size', COALESCE(s.size, 0),
    'active', (SELECT COALESCE(jsonb_object_agg(g.offset_wk, g.active), '{}'::jsonb) FROM grid g WHERE g.cohort_week = c.cohort_week)
  ) ORDER BY c.cohort_week), '[]'::jsonb)
  FROM cohorts c LEFT JOIN sizes s ON s.cohort_week = c.cohort_week;
$$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT jsonb_build_object(
    'users_total',  (SELECT count(*) FROM auth.users),
    'users_new_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_prev_7d',(SELECT count(*) FROM auth.users WHERE created_at BETWEEN now() - interval '14 days' AND now() - interval '7 days'),
    'users_new_30d',(SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'users_banned', (SELECT count(*) FROM auth.users WHERE banned_until IS NOT NULL AND banned_until > now()),
    'dau', (SELECT count(DISTINCT user_id) FROM app_activity_days WHERE day >= current_date),
    'wau', (SELECT count(DISTINCT user_id) FROM app_activity_days WHERE day >= current_date - 6),
    'mau', (SELECT count(DISTINCT user_id) FROM app_activity_days WHERE day >= current_date - 29),
    'expenses_total',    (SELECT count(*) FROM expenses WHERE deleted_at IS NULL),
    'expenses_7d',       (SELECT count(*) FROM expenses WHERE deleted_at IS NULL AND created_at > now() - interval '7 days'),
    'sms_enabled_users', (SELECT count(*) FROM user_settings WHERE sms_tracking_enabled),
    'push_devices',      (SELECT count(*) FROM push_tokens),
    'platforms', (SELECT COALESCE(jsonb_object_agg(platform, c), '{}'::jsonb)
                  FROM (SELECT COALESCE(platform, 'unknown') AS platform, count(DISTINCT user_id) AS c FROM push_tokens GROUP BY 1) x),
    'sms_24h', (SELECT jsonb_build_object(
                  'total', count(*), 'parsed', count(*) FILTER (WHERE parsed_ok),
                  'failed', count(*) FILTER (WHERE status IN ('failed', 'add_failed')),
                  'rejected', count(*) FILTER (WHERE status = 'rejected'),
                  'pending', count(*) FILTER (WHERE status = 'processing'))
                FROM sms_parse_log WHERE received_at > now() - interval '1 day'),
    'sms_7d', (SELECT jsonb_build_object(
                  'total', count(*), 'parsed', count(*) FILTER (WHERE parsed_ok),
                  'failed', count(*) FILTER (WHERE status IN ('failed', 'add_failed')))
                FROM sms_parse_log WHERE received_at > now() - interval '7 days'),
    'tickets', (SELECT jsonb_build_object(
                  'open', count(*) FILTER (WHERE status = 'open'), 'pending', count(*) FILTER (WHERE status = 'pending'),
                  'urgent', count(*) FILTER (WHERE status IN ('open', 'pending') AND priority = 'urgent'),
                  'unassigned', count(*) FILTER (WHERE status IN ('open', 'pending') AND assignee_id IS NULL))
                FROM support_tickets),
    'plans', (SELECT COALESCE(jsonb_agg(jsonb_build_object('plan', plan_key, 'status', status, 'users', c)), '[]'::jsonb)
              FROM (SELECT plan_key, status, count(*) AS c FROM user_entitlements GROUP BY 1, 2) p)
  );
$$;

-- admin_user_overview: only the activity block changes.
DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'admin_user_overview';
  def := replace(def, '(SELECT max(created_at) FROM app_analytics_events WHERE user_id = p_user)', '(SELECT max(last_event_at) FROM app_activity_days WHERE user_id = p_user)');
  def := replace(def, '(SELECT count(*) FROM app_analytics_events WHERE user_id = p_user AND event_type = ''session_start'' AND created_at > now() - interval ''30 days'')', '(SELECT COALESCE(sum(sessions), 0) FROM app_activity_days WHERE user_id = p_user AND day > current_date - 30)');
  def := replace(def, '(SELECT count(DISTINCT created_at::date) FROM app_analytics_events WHERE user_id = p_user AND created_at > now() - interval ''30 days'')', '(SELECT count(DISTINCT day) FROM app_activity_days WHERE user_id = p_user AND day > current_date - 30)');
  IF position('app_analytics_events' IN def) > 0 THEN RAISE EXCEPTION 'admin_user_overview still reads raw events'; END IF;
  EXECUTE def;
END $$;

-- admin_user_directory: last activity from the view.
DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'admin_user_directory';
  def := replace(def, '(SELECT max(created_at) FROM app_analytics_events a WHERE a.user_id = u.id)', '(SELECT max(a.last_event_at) FROM app_activity_days a WHERE a.user_id = u.id)');
  def := replace(def, '(SELECT max(a.created_at) FROM app_analytics_events a WHERE a.user_id = page.id)', '(SELECT max(a.last_event_at) FROM app_activity_days a WHERE a.user_id = page.id)');
  IF position('app_analytics_events' IN def) > 0 THEN RAISE EXCEPTION 'admin_user_directory still reads raw events'; END IF;
  EXECUTE def;
END $$;

-- Name search on profiles uses trigram indexes (email search stays on auth.users, which we do not own).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS profiles_name_trgm_idx ON public.profiles USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx ON public.profiles USING gin (display_name extensions.gin_trgm_ops);

-- Cache of the heavy admin aggregates, refreshed on a schedule.
CREATE TABLE IF NOT EXISTS public.admin_metrics_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_metrics_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_metrics_cache FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_refresh_metrics() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  INSERT INTO admin_metrics_cache (key, value) VALUES
    ('overview', admin_overview()),
    ('feature_adoption', admin_feature_adoption()),
    ('sms_health_7', admin_sms_health(7)),
    ('retention_8', admin_retention(8)),
    ('signup_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_signup_series(30) s), '[]'::jsonb)),
    ('activity_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_activity_series(30) s), '[]'::jsonb))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = now();
END $$;
REVOKE ALL ON FUNCTION public.admin_refresh_metrics() FROM PUBLIC, anon, authenticated;

SELECT public.admin_refresh_metrics();

-- Schedules (UTC). Raw events roll up shortly after midnight; metrics refresh every 15 minutes; cron's own log is trimmed.
SELECT cron.schedule('analytics-rollup', '20 0 * * *', $$SELECT public.analytics_rollup()$$);
SELECT cron.schedule('admin-metrics', '*/15 * * * *', $$SELECT public.admin_refresh_metrics()$$);
SELECT cron.schedule('cron-log-trim', '40 0 * * *', $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days'$$);

-- Roll up what is already there (all closed days), so the table starts small.
SELECT public.analytics_rollup();
