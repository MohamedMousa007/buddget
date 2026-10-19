-- Compact, permanent summary of raw analytics events: one row per user per UTC day. Raw events can then be retired
-- without losing who was active, how often, for how long, and where. Service role only (no policies).
CREATE TABLE IF NOT EXISTS public.app_analytics_daily (
  day date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessions integer NOT NULL DEFAULT 0,
  visibility_events integer NOT NULL DEFAULT 0,
  heartbeats integer NOT NULL DEFAULT 0,
  active_seconds integer NOT NULL DEFAULT 0,
  first_event_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  paths jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (day, user_id)
);
ALTER TABLE public.app_analytics_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_analytics_daily FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_analytics_daily TO service_role;

-- Backfill whole UTC days before 2026-06-22 (a fixed, day-aligned cutoff so no day is summarised halfway). Idempotent: re-running changes nothing.
INSERT INTO public.app_analytics_daily (day, user_id, sessions, visibility_events, heartbeats, active_seconds, first_event_at, last_event_at, paths)
SELECT d.day, d.user_id, d.sessions, d.visibility_events, d.heartbeats, d.active_seconds, d.first_event_at, d.last_event_at,
       COALESCE((SELECT jsonb_object_agg(p.path, p.n) FROM (
         SELECT e.metadata->>'path' AS path, count(*) AS n
         FROM public.app_analytics_events e
         WHERE e.user_id = d.user_id AND (e.created_at AT TIME ZONE 'UTC')::date = d.day AND e.created_at < '2026-06-22 00:00:00+00' AND e.metadata->>'path' IS NOT NULL
         GROUP BY 1) p), '{}'::jsonb)
FROM (
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id,
         count(*) FILTER (WHERE event_type = 'session_start')::int AS sessions,
         count(*) FILTER (WHERE event_type = 'visibility_visible')::int AS visibility_events,
         count(*) FILTER (WHERE event_type = 'heartbeat')::int AS heartbeats,
         COALESCE(sum(CASE WHEN event_type = 'heartbeat' AND (metadata->>'seconds') ~ '^[0-9]+$' THEN (metadata->>'seconds')::int END), 0)::int AS active_seconds,
         min(created_at) AS first_event_at, max(created_at) AS last_event_at
  FROM public.app_analytics_events
  WHERE created_at < '2026-06-22 00:00:00+00' AND user_id IS NOT NULL
  GROUP BY 1, 2
) d
ON CONFLICT (day, user_id) DO NOTHING;
