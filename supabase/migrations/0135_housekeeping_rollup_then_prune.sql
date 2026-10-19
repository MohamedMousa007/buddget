-- Daily housekeeping. Analytics events are summarised into app_analytics_daily first, and only events whose
-- user-day is already in the summary are deleted, so nothing of value is lost. Finished quota reservations are
-- pure bookkeeping and are simply removed after a week.
CREATE OR REPLACE FUNCTION public.housekeeping(p_analytics_days integer DEFAULT 120) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cutoff timestamptz := (date_trunc('day', (now() AT TIME ZONE 'UTC') - make_interval(days => GREATEST(p_analytics_days, 30)))) AT TIME ZONE 'UTC';
  v_rolled integer;
  v_events integer;
  v_reservations integer;
BEGIN
  INSERT INTO app_analytics_daily (day, user_id, sessions, visibility_events, heartbeats, active_seconds, first_event_at, last_event_at, paths)
  SELECT d.day, d.user_id, d.sessions, d.visibility_events, d.heartbeats, d.active_seconds, d.first_event_at, d.last_event_at,
         COALESCE((SELECT jsonb_object_agg(p.path, p.n) FROM (
           SELECT e.metadata->>'path' AS path, count(*) AS n FROM app_analytics_events e
           WHERE e.user_id = d.user_id AND (e.created_at AT TIME ZONE 'UTC')::date = d.day AND e.created_at < cutoff AND e.metadata->>'path' IS NOT NULL
           GROUP BY 1) p), '{}'::jsonb)
  FROM (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day, user_id,
           count(*) FILTER (WHERE event_type = 'session_start')::int AS sessions,
           count(*) FILTER (WHERE event_type = 'visibility_visible')::int AS visibility_events,
           count(*) FILTER (WHERE event_type = 'heartbeat')::int AS heartbeats,
           COALESCE(sum(CASE WHEN event_type = 'heartbeat' AND (metadata->>'seconds') ~ '^[0-9]+$' THEN (metadata->>'seconds')::int END), 0)::int AS active_seconds,
           min(created_at) AS first_event_at, max(created_at) AS last_event_at
    FROM app_analytics_events WHERE created_at < cutoff AND user_id IS NOT NULL GROUP BY 1, 2
  ) d
  ON CONFLICT (day, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rolled = ROW_COUNT;

  DELETE FROM app_analytics_events e WHERE e.created_at < cutoff
    AND EXISTS (SELECT 1 FROM app_analytics_daily d WHERE d.user_id = e.user_id AND d.day = (e.created_at AT TIME ZONE 'UTC')::date);
  GET DIAGNOSTICS v_events = ROW_COUNT;

  DELETE FROM ai_reservations WHERE created_at < now() - interval '7 days' AND (settled OR expires_at < now());
  GET DIAGNOSTICS v_reservations = ROW_COUNT;

  RETURN jsonb_build_object('rolled_up_days', v_rolled, 'events_removed', v_events, 'reservations_removed', v_reservations);
END $$;
REVOKE ALL ON FUNCTION public.housekeeping(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.housekeeping(integer) TO service_role;
