-- B3/S3 (O4, O7, O8, O10/C24): admin permission split, email suppression list, analytics_touch bounds, app-config bounds.
-- NOT APPLIED when written. Idempotent: safe to run twice.
--
-- DEPLOY ORDER
--   1. Apply this migration FIRST. The new app code (a) checks the users.notify / users.security permissions that
--      step 2 below seeds into the roles, and (b) the Resend webhook writes public.email_suppressions: until the
--      table exists that webhook answers 500 and Resend retries (harmless, but noisy).
--   2. Deploy the app. Between the two, no admin loses access: users.tools keeps working for the repair tools.
--   3. Regenerate src/lib/supabase/database.types.ts (adds email_suppressions).
--   Rollback: restore the previous function bodies (live definitions at 2026-10-28 are quoted in the comments below),
--   DROP TRIGGER platform_settings_validate, DROP TABLE email_suppressions, and remove the two permissions from admin_roles.
--
-- BACKUPS: none needed. No existing row is deleted or rewritten except admin_roles.permissions (appends two strings;
-- the audit row count below shows exactly which roles) and nothing else; no backup table is created.
--
-- AUDIT BEFORE APPLY (SELECT only), expected values at 2026-10-28:
--   select key, is_system, permissions @> array['users.tools'] as has_tools from admin_roles order by rank;
--       -> admin, support_lead, support_agent hold users.tools; no non-system role exists
--   select count(*) from admin_staff where extra_permissions @> array['users.tools'];        -- 0
--   select max(active_seconds), max(sessions) from app_analytics_daily;                          -- 46620 / 30 (both under the new caps)
--   select value from platform_settings where key = 'min_app_version';                          -- no row (nothing to validate yet)
--   select count(*) from information_schema.tables where table_schema='public' and table_name='email_suppressions'; -- 0

-- ---------------------------------------------------------------------------------------------------------
-- O4: users.tools is split. users.notify (push / in-app message) and users.security (password reset email,
-- trusted devices, biometric sign-in) are new. support_agent keeps users.tools only (SMS pairing, push registrations).
-- ---------------------------------------------------------------------------------------------------------
UPDATE public.admin_roles
SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['users.notify', 'users.security']) AS p ORDER BY p)
WHERE key IN ('admin', 'support_lead')
  AND NOT (permissions @> ARRAY['users.notify', 'users.security']);

-- Custom roles that held users.tools before keep what they could do.
UPDATE public.admin_roles
SET permissions = ARRAY(SELECT DISTINCT p FROM unnest(permissions || ARRAY['users.notify', 'users.security']) AS p ORDER BY p)
WHERE NOT is_system
  AND permissions @> ARRAY['users.tools']
  AND NOT (permissions @> ARRAY['users.notify', 'users.security']);

-- ---------------------------------------------------------------------------------------------------------
-- O7: addresses Resend reported as hard-bounced or complained. Service role only (RLS on, no policy, no client grants).
-- ---------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email      text PRIMARY KEY CHECK (email = lower(email)),
  reason     text NOT NULL CHECK (reason IN ('bounced', 'complained')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_suppressions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_suppressions TO service_role;
CREATE INDEX IF NOT EXISTS email_suppressions_expires_idx ON public.email_suppressions (expires_at);

-- ---------------------------------------------------------------------------------------------------------
-- O10 / C24: analytics_touch bounds. Same signature (installed apps keep working).
-- Live definition replaced: it capped one call at 5 sessions / 900 seconds but not the day, kept any key length, and
-- had no rate limit. Now: at most 120 calls per hour per user (extra calls are silently dropped), 86400 seconds and
-- 200 sessions per day, at most 30 page keys of at most 80 characters with counts of at most 1000.
-- ---------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_touch(p_seconds integer DEFAULT 0, p_sessions integer DEFAULT 0, p_paths jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  clean jsonb;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF NOT public.api_rate_hit('analytics_touch:' || uid::text, 3600, 120) THEN RETURN; END IF;

  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb) INTO clean
  FROM (
    SELECT left(key, 80) AS k, LEAST(sum(value::int), 1000) AS v
    FROM jsonb_each_text(CASE WHEN jsonb_typeof(p_paths) = 'object' THEN p_paths ELSE '{}'::jsonb END)
    WHERE value ~ '^[0-9]{1,4}$' AND key <> ''
    GROUP BY left(key, 80)
    ORDER BY sum(value::int) DESC
    LIMIT 30
  ) s;

  INSERT INTO app_analytics_daily AS d (day, user_id, sessions, visibility_events, heartbeats, active_seconds, first_event_at, last_event_at, paths)
  VALUES ((now() AT TIME ZONE 'UTC')::date, uid, LEAST(GREATEST(COALESCE(p_sessions, 0), 0), 5), 0, 1,
          LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 900), now(), now(), public.jsonb_counts_add(NULL, clean))
  ON CONFLICT (day, user_id) DO UPDATE SET
    sessions       = LEAST(d.sessions + EXCLUDED.sessions, 200),
    heartbeats     = d.heartbeats + 1,
    active_seconds = LEAST(d.active_seconds + EXCLUDED.active_seconds, 86400),
    last_event_at  = now(),
    paths          = public.jsonb_counts_add(d.paths, EXCLUDED.paths);
END $function$;

-- api_rate_hit: the "delete expired rows" ran on every hit. It now runs on about 2% of hits (the
-- api_rate_limits_cleanup_idx index on window_start keeps that delete cheap). Same signature and result.
-- Live definition replaced (2026-10-28): identical except the guarded cleanup.
CREATE OR REPLACE FUNCTION public.api_rate_hit(p_key text, p_window_seconds integer, p_max_hits integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bucket timestamptz := date_trunc('second', now()) - make_interval(secs => mod(extract(epoch from now())::int, p_window_seconds));
  v_hits int;
begin
  insert into public.api_rate_limits(key, window_start, hits)
  values (p_key, v_bucket, 1)
  on conflict (key, window_start) do update set hits = api_rate_limits.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.api_rate_limits where window_start < now() - interval '1 hour';
  end if;
  return v_hits <= p_max_hits;
end;
$function$;

-- ---------------------------------------------------------------------------------------------------------
-- O8: app-config bounds at the database. platform_settings.min_app_version must be well-formed ("1", "1.2" or "1.2.3",
-- each part at most 3 digits) for ios / android, with https update links, so a bad write cannot reach app_client_gate.
-- (The "above the newest release" check needs the code constant and lives in the admin route, with a typed confirmation.)
-- ---------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.validate_platform_setting()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE plat text;
BEGIN
  IF NEW.key = 'min_app_version' THEN
    IF jsonb_typeof(NEW.value) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'min_app_version must be an object';
    END IF;
    FOREACH plat IN ARRAY ARRAY['ios', 'android'] LOOP
      IF coalesce(NEW.value->>plat, '') <> '' AND NEW.value->>plat !~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,2}$' THEN
        RAISE EXCEPTION 'min_app_version.% is not a version like 1.2.3', plat;
      END IF;
      IF coalesce(NEW.value->>(plat || '_url'), '') <> '' AND NEW.value->>(plat || '_url') !~* '^https://' THEN
        RAISE EXCEPTION 'min_app_version.%_url must be an https link', plat;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS platform_settings_validate ON public.platform_settings;
CREATE TRIGGER platform_settings_validate
  BEFORE INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION private.validate_platform_setting();
