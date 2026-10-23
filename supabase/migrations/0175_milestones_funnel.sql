-- Aggregate-only product analytics for a small database: no new event stream. A user's first-time milestones are
-- derived once per night from tables the app already writes; the funnel and D1/D7/D30 retention are small counts
-- over that, served from admin_metrics_cache.
CREATE TABLE IF NOT EXISTS public.user_milestones (
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  first_at  timestamptz NOT NULL,
  PRIMARY KEY (user_id, milestone)
);
CREATE INDEX IF NOT EXISTS user_milestones_milestone_idx ON public.user_milestones (milestone, first_at);
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_milestones FROM anon, authenticated;

-- Only users still missing a milestone are probed, each probe is an indexed min() on user_id, and the work is done once a night.
CREATE OR REPLACE FUNCTION public.refresh_user_milestones() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'signed_up', u.created_at FROM auth.users u
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT p.id, 'onboarding_done', (p.financial_profile -> 'onboarding' ->> 'doneAt')::timestamptz
  FROM profiles p
  WHERE (p.financial_profile -> 'onboarding' ->> 'doneAt') ~ '^\d{4}-'
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'first_account', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM payment_methods WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'first_account')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'first_income', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM income_events WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'first_income')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'first_expense', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM expenses WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'first_expense')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'sms_enabled', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM sms_ingest_tokens WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'sms_enabled')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'budget_created', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM budget_plans WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'budget_created')
  ON CONFLICT DO NOTHING;

  INSERT INTO user_milestones (user_id, milestone, first_at)
  SELECT u.id, 'goal_created', x.t FROM auth.users u
  CROSS JOIN LATERAL (SELECT min(created_at) AS t FROM goals WHERE user_id = u.id) x
  WHERE x.t IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_milestones m WHERE m.user_id = u.id AND m.milestone = 'goal_created')
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.refresh_user_milestones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_milestones() TO service_role;

-- Funnel over everyone (p_days null) or only people who signed up in the last p_days days.
CREATE OR REPLACE FUNCTION public.admin_funnel(p_days integer DEFAULT NULL) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH base AS (
    SELECT user_id FROM user_milestones
    WHERE milestone = 'signed_up' AND (p_days IS NULL OR first_at >= now() - make_interval(days => LEAST(GREATEST(p_days, 1), 365)))
  ), steps(ord, milestone) AS (
    VALUES (1, 'signed_up'), (2, 'onboarding_done'), (3, 'first_account'), (4, 'first_income'), (5, 'first_expense'),
           (6, 'sms_enabled'), (7, 'budget_created'), (8, 'goal_created')
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'milestone', s.milestone,
    'users', (SELECT count(*) FROM user_milestones m JOIN base b ON b.user_id = m.user_id WHERE m.milestone = s.milestone)
  ) ORDER BY s.ord), '[]'::jsonb) FROM steps s
$$;
REVOKE ALL ON FUNCTION public.admin_funnel(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel(integer) TO service_role;

-- Classic day-N retention: of people whose Nth day after signup has fully passed, the share active on exactly that day.
CREATE OR REPLACE FUNCTION public.admin_retention_days(p_signup_days integer DEFAULT 90) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  WITH n(d) AS (VALUES (1), (7), (30)), cohort AS (
    SELECT u.id, (u.created_at AT TIME ZONE 'UTC')::date AS signup_day FROM auth.users u
    WHERE u.created_at >= now() - make_interval(days => LEAST(GREATEST(p_signup_days, 7), 365))
  )
  SELECT COALESCE(jsonb_object_agg('d' || n.d, jsonb_build_object(
    'eligible', (SELECT count(*) FROM cohort c WHERE c.signup_day + n.d < (now() AT TIME ZONE 'UTC')::date),
    'retained', (SELECT count(*) FROM cohort c WHERE c.signup_day + n.d < (now() AT TIME ZONE 'UTC')::date
                 AND EXISTS (SELECT 1 FROM app_analytics_daily a WHERE a.user_id = c.id AND a.day = c.signup_day + n.d))
  )), '{}'::jsonb) FROM n
$$;
REVOKE ALL ON FUNCTION public.admin_retention_days(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retention_days(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_refresh_metrics() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
BEGIN
  INSERT INTO admin_metrics_cache (key, value) VALUES
    ('overview', admin_overview()),
    ('feature_adoption', admin_feature_adoption()),
    ('sms_health_7', admin_sms_health(7)),
    ('retention_8', admin_retention(8)),
    ('signup_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_signup_series(30) s), '[]'::jsonb)),
    ('activity_series_30', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM admin_activity_series(30) s), '[]'::jsonb)),
    ('funnel_all', admin_funnel(NULL)),
    ('funnel_30', admin_funnel(30)),
    ('retention_days', admin_retention_days(90))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, computed_at = now();
END $$;

SELECT public.refresh_user_milestones();
SELECT cron.schedule('user-milestones', '10 1 * * *', 'SELECT public.refresh_user_milestones()');
