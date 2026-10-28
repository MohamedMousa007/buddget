-- Same funnel, with a cast that cannot fail on a bad row.
CREATE OR REPLACE FUNCTION public.admin_onboarding_funnel(p_days integer DEFAULT 30) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH ev AS (
    SELECT user_id, event_type, metadata
    FROM app_analytics_events
    WHERE event_type LIKE 'onboarding\_%' AND created_at > now() - make_interval(days => GREATEST(1, LEAST(p_days, 180)))
  )
  SELECT jsonb_build_object(
    'started',   (SELECT count(DISTINCT user_id) FROM ev WHERE event_type = 'onboarding_started'),
    'completed', (SELECT count(DISTINCT user_id) FROM ev WHERE event_type = 'onboarding_completed'),
    'left',      (SELECT count(DISTINCT user_id) FROM ev WHERE event_type = 'onboarding_skipped'),
    'steps', (SELECT COALESCE(jsonb_agg(jsonb_build_object('step', step, 'viewed', viewed, 'completed', done) ORDER BY ord), '[]'::jsonb)
              FROM (
                SELECT s.step, s.ord,
                       (SELECT count(DISTINCT user_id) FROM ev WHERE event_type = 'onboarding_step_view'     AND metadata->>'step' = s.step) AS viewed,
                       (SELECT count(DISTINCT user_id) FROM ev WHERE event_type = 'onboarding_step_complete' AND metadata->>'step' = s.step) AS done
                FROM (VALUES ('about', 1), ('goals', 2), ('accounts', 3), ('income', 4), ('automate', 5), ('budget', 6)) AS s(step, ord)
              ) x),
    'permissions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', kind, 'granted', granted, 'users', n)), '[]'::jsonb)
                    FROM (SELECT metadata->>'kind' AS kind, CASE WHEN metadata->>'granted' IN ('true', 'false') THEN (metadata->>'granted')::boolean END AS granted, count(DISTINCT user_id) AS n
                          FROM ev WHERE event_type = 'onboarding_permission' GROUP BY 1, 2) p)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_onboarding_funnel(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_funnel(integer) TO service_role;
