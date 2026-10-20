-- Admin screens used to download whole tables to count rows in JavaScript. These return the grouped counts instead.
CREATE OR REPLACE FUNCTION public.admin_entitlement_counts() RETURNS TABLE(plan_key text, status text, n integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT plan_key, status, count(*)::int FROM user_entitlements GROUP BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION public.admin_loyalty_summary() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object(
    'by_tier', COALESCE((SELECT jsonb_object_agg(t, c) FROM (SELECT COALESCE(tier_key, 'none') AS t, count(*)::int AS c FROM loyalty_accounts GROUP BY 1) x), '{}'::jsonb),
    'members', (SELECT count(*) FROM loyalty_accounts),
    'outstanding', COALESCE((SELECT sum(points_balance) FROM loyalty_accounts), 0));
$$;

CREATE OR REPLACE FUNCTION public.admin_ticket_counts() RETURNS TABLE(status text, priority text, assignee_id uuid, n integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT status, priority, assignee_id, count(*)::int FROM support_tickets GROUP BY 1, 2, 3;
$$;

CREATE OR REPLACE FUNCTION public.admin_push_platform_counts() RETURNS TABLE(platform text, n integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(platform, 'unknown'), count(*)::int FROM push_tokens GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_email_status_counts(p_template text DEFAULT NULL, p_locale text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS TABLE(status text, n integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT status, count(*)::int FROM email_log
   WHERE (p_template IS NULL OR template_key = p_template) AND (p_locale IS NULL OR locale = p_locale)
     AND (p_from IS NULL OR created_at >= p_from) AND (p_to IS NULL OR created_at <= p_to)
     AND (p_q IS NULL OR to_email ILIKE '%' || p_q || '%')
   GROUP BY 1;
$$;

REVOKE ALL ON FUNCTION public.admin_entitlement_counts(), public.admin_loyalty_summary(), public.admin_ticket_counts(), public.admin_push_platform_counts(),
  public.admin_email_status_counts(text, text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_entitlement_counts(), public.admin_loyalty_summary(), public.admin_ticket_counts(), public.admin_push_platform_counts(),
  public.admin_email_status_counts(text, text, timestamptz, timestamptz, text) TO service_role;
