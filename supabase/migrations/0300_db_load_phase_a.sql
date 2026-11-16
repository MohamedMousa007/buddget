-- 0300_db_load_phase_a.sql  (database load plan, phase A: stop self-inflicted idle load; no user-visible change)
--
-- Scheduled runs a day: ~2,240 -> ~160. Every job keeps its purpose; only timing and trigger change.
--   admin-metrics        hourly            -> removed; refreshed on admin view when older than 15 min, under an advisory lock
--   sms-zero-variance    hourly            -> daily 04:17 UTC, plus a covering index for its 90-day scan
--   notifications-hourly hourly (live-only) -> captured here; due users found set-based; no HTTP call when nobody is due
--   sms-pending-discards every minute      -> run for the caller inside sync_pull_v2; 15-minute fallback inside sms-tick
--   sms-heal-stuck + sms-stats-drain (5m)  -> one sms-tick every 15 minutes (also the discards fallback), each step exits early
--   api-rate-cleanup     every 10 minutes  -> hourly (api_rate_limits_cleanup_idx on window_start already exists, 0215)
--
-- AUDIT SELECTs (run before applying; expected today in brackets):
--   select count(*) from cron.job;                                                         -- 17
--   select jobname, schedule from cron.job where jobname in ('admin-metrics','sms-pending-discards','sms-heal-stuck','sms-stats-drain','sms-zero-variance','api-rate-cleanup','notifications-hourly');
--   select count(*) from sms_parse_log where discard_requested_at is not null;             -- 0
--
-- ROLLBACK: select cron.unschedule('sms-tick'); select cron.schedule('sms-pending-discards','* * * * *','SELECT public.sms_run_pending_discards()');
--   select cron.schedule('sms-stats-drain','*/5 * * * *','SELECT public.sms_stats_drain()'); select cron.schedule('sms-heal-stuck','*/5 * * * *','SELECT public.sms_heal_stuck()');
--   select cron.schedule('admin-metrics','7 * * * *','SELECT public.admin_refresh_metrics()'); select cron.alter_job((select jobid from cron.job where jobname='sms-zero-variance'), schedule := '17 * * * *');
--   select cron.alter_job((select jobid from cron.job where jobname='api-rate-cleanup'), schedule := '*/10 * * * *');
--   (notifications-hourly: its previous body was a bare net.http_post to /api/cron/notifications with the vault cron_secret; notifications_tick() does the same after a due-users check.)

-- 1. Admin metrics: refresh on demand ------------------------------------------------------------------------------
-- The refresh now writes exactly the keys src/lib/server/admin/metrics.ts reads (retention_10, not the old retention_8;
-- funnel_all was never read). Rows under the retired keys are removed.
CREATE OR REPLACE FUNCTION public.admin_refresh_metrics() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth', 'pg_temp' AS $$
BEGIN
  INSERT INTO admin_metrics_cache (key, value) VALUES
    ('overview', admin_overview()),
    ('feature_adoption', admin_feature_adoption()),
    ('sms_health_7', admin_sms_health(7)),
    ('retention_10', admin_retention(10)),
    ('signup_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_signup_series(30) s), '[]'::jsonb)),
    ('activity_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_activity_series(30) s), '[]'::jsonb)),
    ('funnel_30', admin_funnel(30)),
    ('retention_days', admin_retention_days(90))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = now();
  DELETE FROM admin_metrics_cache WHERE key IN ('retention_8', 'funnel_all');
END $$;
REVOKE ALL ON FUNCTION public.admin_refresh_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refresh_metrics() TO service_role;

-- Refreshes only when the cache is older than p_max_age, and only one caller at a time (the advisory lock is released at
-- the end of the call). Returns true when this call refreshed.
CREATE OR REPLACE FUNCTION public.admin_refresh_metrics_if_stale(p_max_age interval DEFAULT interval '15 minutes') RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('admin_refresh_metrics')) THEN RETURN false; END IF;
  IF (SELECT count(*) FROM admin_metrics_cache WHERE computed_at > now() - p_max_age) >= 8 THEN RETURN false; END IF;
  PERFORM public.admin_refresh_metrics();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_refresh_metrics_if_stale(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refresh_metrics_if_stale(interval) TO service_role;

SELECT cron.unschedule('admin-metrics') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-metrics');

-- 2. SMS zero-variance: daily, with an index for the 90-day scan ---------------------------------------------------
CREATE INDEX IF NOT EXISTS sms_parse_log_zero_variance_idx
  ON public.sms_parse_log (matched_template_id, received_at) INCLUDE (sms_hash, amount)
  WHERE matched_template_id IS NOT NULL AND amount IS NOT NULL AND sms_hash IS NOT NULL;

-- Early exit: nothing to judge when no active template exists.
CREATE OR REPLACE FUNCTION public.sms_zero_variance_sweep() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE r record; n integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sms_tracking_templates_ai WHERE status = 'active' AND hard_fail = false) THEN RETURN 0; END IF;
  FOR r IN SELECT * FROM detect_zero_variance_templates(4) LOOP
    PERFORM bump_sms_template_failure(r.template_id, true, 'zero_variance_amount: ' || r.amount || ' across ' || r.distinct_bodies || ' distinct bodies');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_zero_variance_sweep() FROM PUBLIC, anon, authenticated;

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'sms-zero-variance'), schedule := '17 4 * * *');

-- 3. SMS discards: per user in sync, fallback in sms-tick ----------------------------------------------------------
-- One function with an optional user filter replaces the zero-argument one (the 30-second undo window is unchanged).
DROP FUNCTION IF EXISTS public.sms_run_pending_discards();
CREATE OR REPLACE FUNCTION public.sms_run_pending_discards(p_user uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  r record;
  v_done int := 0;
BEGIN
  FOR r IN SELECT id, user_id FROM public.sms_parse_log
            WHERE discard_requested_at IS NOT NULL AND discard_requested_at <= now() - interval '30 seconds'
              AND (p_user IS NULL OR user_id = p_user)
            ORDER BY discard_requested_at LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.expenses WHERE sms_log_id = r.id AND deleted_at IS NULL AND description IS DISTINCT FROM 'Transfer fee')
         AND NOT EXISTS (SELECT 1 FROM public.income_events WHERE sms_log_id = r.id AND deleted_at IS NULL) THEN
        PERFORM public.sms_discard_message(r.user_id, r.id);
        v_done := v_done + 1;
      END IF;
      UPDATE public.sms_parse_log SET discard_requested_at = NULL WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'sms_run_pending_discards: log % failed: %', r.id, SQLERRM;
      UPDATE public.sms_parse_log SET discard_requested_at = NULL WHERE id = r.id;
    END;
  END LOOP;
  RETURN v_done;
END $$;
REVOKE ALL ON FUNCTION public.sms_run_pending_discards(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_run_pending_discards(uuid) TO service_role;

-- The caller's own overdue discards, used by sync_pull_v2. Never raises: a failure here must not break a sync.
CREATE OR REPLACE FUNCTION public.sms_run_my_pending_discards() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  RETURN public.sms_run_pending_discards(auth.uid());
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END $$;
REVOKE ALL ON FUNCTION public.sms_run_my_pending_discards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sms_run_my_pending_discards() TO authenticated, service_role;

-- Volatile now (it may discard); payload and argument unchanged. supabase-js rpc() is a POST, so it runs read-write.
CREATE OR REPLACE FUNCTION public.sync_pull_v2(p_since timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF p_since IS NOT NULL AND p_since < now() - interval '60 days' THEN
    RETURN jsonb_build_object('needs_full', true, 'cursor', now());
  END IF;
  PERFORM public.sms_run_my_pending_discards();
  RETURN public.sync_pull(p_since);
END $$;

-- 4. One SMS tick every 15 minutes: heal stuck rows, drain stats, sweep overdue discards. Every step exits early. ---
CREATE OR REPLACE FUNCTION public.sms_heal_stuck() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sms_parse_log WHERE status = 'processing') THEN RETURN 0; END IF;
  UPDATE sms_parse_log SET status = 'failed', failure_code = 'timed_out'
   WHERE status = 'processing' AND coalesce(parsed_at, created_at) < now() - interval '2 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_heal_stuck() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sms_tick() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer := 0;
BEGIN
  n := n + public.sms_heal_stuck();
  IF EXISTS (SELECT 1 FROM sms_stats_outbox LIMIT 1) THEN n := n + public.sms_stats_drain(); END IF;
  IF EXISTS (SELECT 1 FROM sms_parse_log WHERE discard_requested_at IS NOT NULL) THEN n := n + public.sms_run_pending_discards(NULL); END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_tick() TO service_role;

SELECT cron.unschedule(j) FROM unnest(ARRAY['sms-pending-discards', 'sms-heal-stuck', 'sms-stats-drain']) j
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j);
-- cron-frequency-reason: sms-tick is the one 15-minute job (the floor); all three steps exit on an index probe when idle.
SELECT cron.schedule('sms-tick', '*/15 * * * *', 'SELECT public.sms_tick()');

-- 5. Rate-limit cleanup: hourly (its window_start index already exists, 0215) --------------------------------------
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'api-rate-cleanup'), schedule := '0 * * * *');

-- 6. Notifications: due users in one query; no HTTP call when nobody is due -----------------------------------------
-- A conservative prefilter; the route still decides per user (TypeScript owns the rules). Due = local hour 09:00-20:59 AND
-- (has something that can alert, OR is within 6 days of the budget-month end so the month-end notice can fire; widened
-- from 3 so start days above 28 are never missed). user_settings.timezone may be NULL or invalid: sms_safe_tz falls back to Cairo.
CREATE OR REPLACE FUNCTION public.notification_due_users(p_now timestamptz DEFAULT now(), p_after uuid DEFAULT NULL, p_limit integer DEFAULT 500)
RETURNS TABLE (user_id uuid, language text, timezone text, month_start_day integer, sub_due_reminders boolean,
               sub_price_alerts boolean, goal_alerts boolean, is_candidate boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  WITH cand AS (SELECT unnest(public.notification_candidate_users()) AS u),
  base AS (
    SELECT us.user_id, us.language::text AS language, us.timezone, us.month_start_day, us.sub_due_reminders, us.sub_price_alerts, us.goal_alerts,
           (p_now AT TIME ZONE public.sms_safe_tz(us.timezone)) AS local_ts,
           GREATEST(LEAST(COALESCE(us.month_start_day, 1), 28), 1) AS d
      FROM user_settings us
     WHERE p_after IS NULL OR us.user_id > p_after
  ),
  win AS (
    SELECT b.*, b.local_ts::date AS l,
           make_date(extract(year FROM b.local_ts)::int, extract(month FROM b.local_ts)::int, b.d) AS this_start
      FROM base b
     WHERE extract(hour FROM b.local_ts) >= 9 AND extract(hour FROM b.local_ts) < 21
  ),
  due AS (
    SELECT w.*, (w.user_id IN (SELECT u FROM cand)) AS is_cand,
           ((CASE WHEN w.l >= w.this_start THEN w.this_start ELSE (w.this_start - interval '1 month')::date END) + interval '1 month')::date - 1 AS period_end
      FROM win w
  )
  SELECT due.user_id, due.language, due.timezone, due.month_start_day, due.sub_due_reminders, due.sub_price_alerts, due.goal_alerts, due.is_cand
    FROM due
   WHERE due.is_cand OR (due.period_end - due.l) BETWEEN 0 AND 6
   ORDER BY due.user_id
   LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.notification_due_users(timestamptz, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_due_users(timestamptz, uuid, integer) TO service_role;

-- The scheduled entry point: asks the database first, so an idle hour costs one cheap query and no HTTP request.
-- The secret stays in vault (unchanged from the live job); the route authenticates it as before.
CREATE OR REPLACE FUNCTION public.notifications_tick() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'pg_temp' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.notification_due_users(now(), NULL, 1)) THEN RETURN false; END IF;
  PERFORM net.http_post(
    url := 'https://my.buddget.app/api/cron/notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')),
    timeout_milliseconds := 55000
  );
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.notifications_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notifications_tick() TO service_role;

-- cron-frequency-reason: hourly is required; each user's 09:00 delivery window opens on a different UTC hour.
SELECT cron.schedule('notifications-hourly', '0 * * * *', 'SELECT public.notifications_tick()');
