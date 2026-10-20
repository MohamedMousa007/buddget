-- Retention for everything that grows without bound (scaling plan phase 5). Each rule removes only what has no further use:
--  * AI usage events are summed per user, day, feature and model before the detail is dropped (90 days).
--  * Deleted rows (tombstones) are removed after 90 days; every client has synced by then.
--  * Notifications 90 days, email log 180 days (bounces and complaints 365), finished admin sessions 30 days.
--  * One-off SMS skeletons leave with the raw text at 30 days; recurring skeletons (the knowledge) stay.
-- Everything is batched so no single statement holds locks for long, and runs from pg_cron.

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  day date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  feature text NOT NULL,
  model text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  failed_calls integer NOT NULL DEFAULT 0,
  in_tokens bigint NOT NULL DEFAULT 0,
  cached_tokens bigint NOT NULL DEFAULT 0,
  out_tokens bigint NOT NULL DEFAULT 0,
  units numeric NOT NULL DEFAULT 0,
  latency_ms_total bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id, feature, model)
);
CREATE INDEX IF NOT EXISTS ai_usage_daily_user_idx ON public.ai_usage_daily (user_id);
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_daily FROM anon, authenticated;

-- One-off skeletons are removed with the raw text (30 days); only recurring wording is kept.
CREATE OR REPLACE FUNCTION public.sms_retention() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  UPDATE sms_parse_log SET raw_body = NULL, push_result = NULL
   WHERE id IN (SELECT id FROM sms_parse_log WHERE received_at < now() - interval '30 days' AND harvested_at IS NOT NULL AND raw_body IS NOT NULL LIMIT 5000);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - interval '30 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sms_retention() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.housekeeping(p_analytics_days integer DEFAULT 120) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  n integer; total integer; t text; k integer;
BEGIN
  PERFORM analytics_rollup();

  DELETE FROM ai_reservations WHERE created_at < now() - interval '7 days' AND (settled OR expires_at < now());
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('ai_reservations', n);

  total := 0;
  FOR k IN 1..20 LOOP
    WITH d AS (
      DELETE FROM ai_usage_events WHERE id IN (SELECT id FROM ai_usage_events WHERE created_at < now() - interval '90 days' ORDER BY id LIMIT 20000)
      RETURNING user_id, feature, model, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, created_at
    ), a AS (
      SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id, feature, COALESCE(model, 'unknown') AS model,
             count(*)::int AS calls, (count(*) FILTER (WHERE status <> 'ok'))::int AS failed,
             COALESCE(sum(in_tokens), 0) AS s_in, COALESCE(sum(cached_tokens), 0) AS s_cached, COALESCE(sum(out_tokens), 0) AS s_out,
             COALESCE(sum(units), 0) AS s_units, COALESCE(sum(latency_ms), 0) AS s_lat
      FROM d GROUP BY 1, 2, 3, 4
    )
    INSERT INTO ai_usage_daily AS x (day, user_id, feature, model, calls, failed_calls, in_tokens, cached_tokens, out_tokens, units, latency_ms_total)
    SELECT day, user_id, feature, model, calls, failed, s_in, s_cached, s_out, s_units, s_lat FROM a
    ON CONFLICT (day, user_id, feature, model) DO UPDATE SET
      calls = x.calls + EXCLUDED.calls, failed_calls = x.failed_calls + EXCLUDED.failed_calls, in_tokens = x.in_tokens + EXCLUDED.in_tokens,
      cached_tokens = x.cached_tokens + EXCLUDED.cached_tokens, out_tokens = x.out_tokens + EXCLUDED.out_tokens,
      units = x.units + EXCLUDED.units, latency_ms_total = x.latency_ms_total + EXCLUDED.latency_ms_total;
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
    total := total + n;
  END LOOP;
  r := r || jsonb_build_object('ai_usage_rolled', total);

  DELETE FROM ai_chats WHERE last_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('ai_chats', n);

  DELETE FROM notifications WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  r := r || jsonb_build_object('notifications', n);

  DELETE FROM email_log WHERE created_at < now() - interval '180 days' AND status NOT IN ('bounced', 'complained');
  DELETE FROM email_log WHERE created_at < now() - interval '365 days';
  DELETE FROM admin_sessions WHERE COALESCE(revoked_at, expires_at) < now() - interval '30 days';

  total := 0;
  FOREACH t IN ARRAY ARRAY[
    'expenses','income_events','income_sources','debts','debt_payments','goals','budget_plans','budget_categories','budget_subcategories',
    'budget_plan_activations','payment_methods','receipts','recurring_debt_payments','recurring_expenses','recurring_savings_deposits',
    'savings_accounts','savings_holdings','savings_transactions','subscriptions','buddgy_memories'
  ] LOOP
    FOR k IN 1..20 LOOP
      EXECUTE format('DELETE FROM public.%I WHERE id IN (SELECT id FROM public.%I WHERE deleted_at < now() - interval ''90 days'' LIMIT 2000)', t, t);
      GET DIAGNOSTICS n = ROW_COUNT;
      EXIT WHEN n = 0;
      total := total + n;
    END LOOP;
  END LOOP;
  r := r || jsonb_build_object('tombstones', total);

  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.housekeeping(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping(integer) TO service_role;

SELECT cron.schedule('housekeeping', '30 1 * * *', $$SELECT public.housekeeping()$$);
