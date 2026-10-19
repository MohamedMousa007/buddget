-- Users with only an email showed no name in the admin portal: profiles.name is often '' (not NULL), and COALESCE keeps ''.
-- The directory and overview now skip blank names and fall back to the sign-in provider's full_name / name.
CREATE OR REPLACE FUNCTION public.admin_user_directory(
  p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_order text DEFAULT 'created_desc', p_plan text DEFAULT NULL, p_state text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE
  result jsonb;
  q text := NULLIF(btrim(p_search), '');
  lim integer := LEAST(GREATEST(p_limit, 1), 200);
  off integer := GREATEST(p_offset, 0);
BEGIN
  IF p_order IN ('active_desc', 'expenses_desc') OR p_state = 'inactive' THEN
    -- Sorting or filtering needs the aggregates for everyone.
    WITH base AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.name), ''), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data->>'name'), '')) AS name, p.country, p.base_currency::text AS currency,
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
      WHERE (q IS NULL OR u.email ILIKE '%' || q || '%' OR p.name ILIKE '%' || q || '%' OR p.display_name ILIKE '%' || q || '%' OR u.raw_user_meta_data->>'full_name' ILIKE '%' || q || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
    ), filtered AS (
      SELECT * FROM base
      WHERE (p_state IS NULL
        OR (p_state = 'banned' AND banned_until IS NOT NULL AND banned_until > now())
        OR (p_state = 'unconfirmed' AND NOT confirmed)
        OR (p_state = 'sms' AND sms_enabled)
        OR (p_state = 'inactive' AND (last_active_at IS NULL OR last_active_at < now() - interval '30 days')))
    ), page AS (
      SELECT * FROM filtered
      ORDER BY
        CASE WHEN p_order = 'active_desc'   THEN last_active_at END DESC NULLS LAST,
        CASE WHEN p_order = 'expenses_desc' THEN expenses END DESC,
        CASE WHEN p_order = 'created_asc'   THEN created_at END ASC,
        CASE WHEN p_order = 'email_asc'     THEN email END ASC,
        created_at DESC
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb)
    ) INTO result;
  ELSE
    -- Cheap path: filter, count and page on plain columns, then aggregate only the rows shown.
    WITH cheap AS (
      SELECT u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
             (u.email_confirmed_at IS NOT NULL) AS confirmed,
             COALESCE(u.raw_app_meta_data->>'provider', 'email') AS provider,
             COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.name), ''), NULLIF(btrim(u.raw_user_meta_data->>'full_name'), ''), NULLIF(btrim(u.raw_user_meta_data->>'name'), '')) AS name, p.country, p.base_currency::text AS currency,
             COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) AS plan_key,
             COALESCE(e.status, 'active') AS plan_status,
             COALESCE(s.sms_tracking_enabled, false) AS sms_enabled
      FROM auth.users u
      LEFT JOIN profiles p ON p.id = u.id
      LEFT JOIN user_entitlements e ON e.user_id = u.id
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE (q IS NULL OR u.email ILIKE '%' || q || '%' OR p.name ILIKE '%' || q || '%' OR p.display_name ILIKE '%' || q || '%' OR u.raw_user_meta_data->>'full_name' ILIKE '%' || q || '%' OR u.id::text = q)
        AND (p_plan IS NULL OR COALESCE(e.plan_key, (SELECT key FROM plans WHERE is_default LIMIT 1)) = p_plan)
        AND (p_state IS NULL
          OR (p_state = 'banned' AND u.banned_until IS NOT NULL AND u.banned_until > now())
          OR (p_state = 'unconfirmed' AND u.email_confirmed_at IS NULL)
          OR (p_state = 'sms' AND COALESCE(s.sms_tracking_enabled, false)))
    ), page AS (
      SELECT *, row_number() OVER (
        ORDER BY
          CASE WHEN p_order = 'created_asc' THEN created_at END ASC,
          CASE WHEN p_order = 'email_asc'   THEN email END ASC,
          created_at DESC
      ) AS rn
      FROM cheap
      ORDER BY rn
      LIMIT lim OFFSET off
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM cheap),
      'rows', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) - 'rn' ORDER BY r.rn)
        FROM (
          SELECT page.*,
                 (SELECT max(a.created_at) FROM app_analytics_events a WHERE a.user_id = page.id) AS last_active_at,
                 (SELECT count(*) FROM expenses x WHERE x.user_id = page.id AND x.deleted_at IS NULL) AS expenses,
                 (SELECT string_agg(DISTINCT t.platform, ',') FROM push_tokens t WHERE t.user_id = page.id) AS platforms
          FROM page
        ) r
      ), '[]'::jsonb)
    ) INTO result;
  END IF;
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
               'name', COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.name), ''), (SELECT NULLIF(btrim(COALESCE(m.raw_user_meta_data->>'full_name', m.raw_user_meta_data->>'name')), '') FROM auth.users m WHERE m.id = p_user)), 'city', p.city, 'country', p.country,
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

GRANT EXECUTE ON FUNCTION public.admin_user_directory(text, integer, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_overview(uuid) TO service_role;
