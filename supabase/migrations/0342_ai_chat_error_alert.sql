-- 1.1b: a daily check on the share of failed Buddgy chat calls per model (BDG-011 follow-up).
-- The quick tier answered every call with a 404 from 19 Oct to 16 Nov 2026 and nothing watched it.
--
-- Failed = status 'error' (provider error, blocked or empty reply) or 'aborted_empty' (the stream stalled or was cut
-- before any text; a user Stop before text lands here too, which the thresholds tolerate). 'ok' and 'aborted' (text
-- reached the user) are healthy. Rows with no model are skipped, so the unique key below always holds.
--
-- A model trips when, over the last 24 hours of feature chat/chat_hop:
--   failed share > maxErrorShare with at least minCalls calls, or every call failed with at least allFailedMinCalls calls.
-- Thresholds live in platform_settings 'ai_chat_error_alert'; a missing key or field falls back to 0.25 / 10 / 3.
-- One alert row per model per UTC day (unique key + ON CONFLICT DO NOTHING). The admin Overview lists the last 7 days.
--
-- ROLLBACK: select cron.unschedule('ai-chat-error-check'); drop function public.ai_chat_error_check();
--   drop table public.ai_model_alerts; drop index public.ai_usage_events_chat_created_idx;
--   delete from public.platform_settings where key = 'ai_chat_error_alert';

CREATE INDEX IF NOT EXISTS ai_usage_events_chat_created_idx
  ON public.ai_usage_events (created_at) INCLUDE (model, status)
  WHERE feature IN ('chat', 'chat_hop');

CREATE TABLE IF NOT EXISTS public.ai_model_alerts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_date      date NOT NULL,
  model           text NOT NULL,
  calls           integer NOT NULL,
  errors          integer NOT NULL,
  empties         integer NOT NULL,
  failed_share    numeric(5,4) NOT NULL,
  rule            text NOT NULL CHECK (rule IN ('share', 'all_failed')),
  thresholds      jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model, alert_date)
);
CREATE INDEX IF NOT EXISTS ai_model_alerts_date_idx ON public.ai_model_alerts (alert_date DESC);
ALTER TABLE public.ai_model_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_model_alerts FROM anon, authenticated;

INSERT INTO public.platform_settings (key, value)
VALUES ('ai_chat_error_alert', '{"maxErrorShare": 0.25, "minCalls": 10, "allFailedMinCalls": 3}')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ai_chat_error_check() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := coalesce((SELECT value FROM platform_settings WHERE key = 'ai_chat_error_alert'), '{}'::jsonb);
  max_share numeric := coalesce((cfg ->> 'maxErrorShare')::numeric, 0.25);
  min_calls integer := coalesce((cfg ->> 'minCalls')::integer, 10);
  all_min integer := coalesce((cfg ->> 'allFailedMinCalls')::integer, 3);
  n integer;
BEGIN
  WITH per_model AS (
    SELECT e.model,
           count(*)::integer AS calls,
           count(*) FILTER (WHERE e.status = 'error')::integer AS errors,
           count(*) FILTER (WHERE e.status = 'aborted_empty')::integer AS empties
      FROM ai_usage_events e
     WHERE e.feature IN ('chat', 'chat_hop')
       AND e.created_at >= now() - interval '24 hours'
       AND e.model IS NOT NULL
     GROUP BY e.model
  ), tripped AS (
    SELECT p.*, (p.errors + p.empties)::numeric / p.calls AS share,
           CASE WHEN p.errors + p.empties = p.calls AND p.calls >= all_min THEN 'all_failed' ELSE 'share' END AS rule
      FROM per_model p
     WHERE (p.calls >= min_calls AND (p.errors + p.empties)::numeric / p.calls > max_share)
        OR (p.calls >= all_min AND p.errors + p.empties = p.calls)
  ), ins AS (
    INSERT INTO ai_model_alerts (alert_date, model, calls, errors, empties, failed_share, rule, thresholds)
    SELECT (now() AT TIME ZONE 'UTC')::date, t.model, t.calls, t.errors, t.empties, round(t.share, 4), t.rule,
           jsonb_build_object('maxErrorShare', max_share, 'minCalls', min_calls, 'allFailedMinCalls', all_min)
      FROM tripped t
    ON CONFLICT (model, alert_date) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;
  DELETE FROM ai_model_alerts WHERE alert_date < (now() AT TIME ZONE 'UTC')::date - 180;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ai_chat_error_check() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_chat_error_check() TO service_role;

SELECT cron.schedule('ai-chat-error-check', '5 6 * * *', 'SELECT public.ai_chat_error_check()');
