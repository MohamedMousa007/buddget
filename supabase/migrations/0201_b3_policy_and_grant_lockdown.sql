-- 0201_b3_policy_and_grant_lockdown.sql  (QA round 2, B3/S1: C2/Q3, Q2/N7, N24, Q19, Q11/N25, C24)
--
-- DEPLOY ORDER: RESTRICTIVE. Apply AFTER the code of B3/S1 is deployed and verified, and after confirming the
-- service-role routes below work. Nothing here is needed by any browser/client path (proven by grep, see PROOF).
-- Idempotent: every statement is DROP IF EXISTS / REVOKE / CREATE OR REPLACE, safe to re-run. Apply with one
-- execute_sql call per numbered section so a failure stays isolated.
--
-- PROOF that no client path touches what is restricted (src, 2026-10-28): trusted_devices, biometric_devices,
-- sms_ingest_tokens, push_tokens, sms_template_*, sms_tracking_templates_ai, sms_corrections, sms_*_pool,
-- sms_promotion_config, sms_sender_currency, ai_price_book, ai_reservations, ai_usage_events, api_rate_limits,
-- fx_rates, live_market_data are read/written ONLY through createServiceRoleClient() (src/app/api/**, src/lib/server,
-- src/lib/sms). The browser client (createClient) touches the sync tables, sms_parse_log (own rows), net_worth_snapshots,
-- goal_allocation_runs, budget_feedback, asset_prices, profiles, user_settings: none of those lose anything here except
-- the unused TRUNCATE/REFERENCES/TRIGGER privileges (PostgREST never issues them) and profiles/user_settings DELETE.
--
-- AUDIT BEFORE APPLY (SELECT only). Expected values measured 2026-10-28:
--   -- policies to drop (expect 5 rows, one per name):
--   select policyname from pg_policies where schemaname='public' and policyname in
--     ('trusted_devices_self_insert','trusted_devices_self_update','sms_ingest_tokens_update_own','profiles_delete_own','user_settings_delete_own');
--   -- anon holds ALL privileges on 54 tables (expect 54):
--   select count(distinct table_name) from information_schema.role_table_grants where table_schema='public' and grantee='anon' and privilege_type='TRUNCATE';
--   -- authenticated holds TRUNCATE on the same tables:
--   select count(distinct table_name) from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type='TRUNCATE';
--   -- the only anon-readable policies must stay asset_prices_select + merchant_categories_read (+ api_rate_limits_client_denied which denies):
--   select tablename, policyname from pg_policies where schemaname='public' and roles::text ~ '(anon|public)';
--   -- sms_ingest_tokens: 20 active tokens for 13 users, untouched by this file:
--   select count(*) filter (where is_active), count(distinct user_id) filter (where is_active) from public.sms_ingest_tokens;
--
-- ROLLBACK (per section): re-create the dropped policy from 0190/earlier migration text, or GRANT the privilege back.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. C2 / Q3: trusted_devices. The device/trust route writes with the service role; a session must never be able to
--    mark its own device trusted (2FA bypass) or refresh last_used_at to dodge the 180-day expiry.
--    F2: authenticated also loses SELECT: the device id is the only credential of a trusted device, so a password-only
--    session must not be able to read it and replay it to /api/auth/device/check. Every read/delete goes through the
--    service role (device/check, device/trust, password/change, /api/devices, admin); no src client path selects it.
--    Kept: own DELETE.
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS trusted_devices_self_insert ON public.trusted_devices;
DROP POLICY IF EXISTS trusted_devices_self_update ON public.trusted_devices;
REVOKE ALL ON public.trusted_devices FROM anon;
REVOKE SELECT, INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.trusted_devices FROM authenticated;

-- biometric_devices: only own SELECT/DELETE policies exist; the routes use the service role.
REVOKE ALL ON public.biometric_devices FROM anon;
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.biometric_devices FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Q2 / N7: sms_ingest_tokens. The owner UPDATE policy let a user PATCH is_active=true on a token an admin or a
--    device revoke had switched off (and rewrite device_id / token). All writes go through setup-token / devices /
--    admin routes (service role). Kept: own SELECT (policy sms_ingest_tokens_select_own).
--    Plaintext tokens: hashing is a long-term item, NOT done here.
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS sms_ingest_tokens_update_own ON public.sms_ingest_tokens;
REVOKE ALL ON public.sms_ingest_tokens FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.sms_ingest_tokens FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. N24: get_sms_keyword_pool(top_n) was executable by anon (unbounded top_n, shared learning data). Only server
--    code reads the pool (no src caller exists). Pin search_path stays as live; add a hard cap so a future grant
--    cannot be abused. Body = live pg_get_functiondef + least(top_n, 1000).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sms_keyword_pool(top_n integer DEFAULT 200)
 RETURNS TABLE(keyword text, lang text, hit_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  select keyword, lang, hit_count
  from public.sms_keyword_pool
  order by hit_count desc
  limit least(greatest(1, top_n), 1000);
$function$;
REVOKE ALL ON FUNCTION public.get_sms_keyword_pool(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sms_keyword_pool(integer) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Q19 / C24: a user can no longer delete their own profile or settings row through PostgREST (account deletion
--    runs through /api/account/delete with the service role). The two columns the server owns cannot be changed by
--    a client session: a BEFORE trigger restores them. (A column-level GRANT list was rejected: it would silently
--    break the sync upsert the next time a profile/settings column is added.)
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
DROP POLICY IF EXISTS user_settings_delete_own ON public.user_settings;
REVOKE DELETE ON public.profiles, public.user_settings FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_server_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Only PostgREST client roles are restricted; service_role routes, definer functions and migrations are not.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.welcome_email_sent_at := null;
      new.data_reset_at := null;
    else
      new.welcome_email_sent_at := old.welcome_email_sent_at;
      new.data_reset_at := old.data_reset_at;
    end if;
  end if;
  return new;
end $function$;
REVOKE ALL ON FUNCTION public.guard_profile_server_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS b_guard_profile_server_columns ON public.profiles;
CREATE TRIGGER b_guard_profile_server_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_server_columns();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Q11 / N25: server-only tables lose every client privilege (service_role is unaffected). RLS stays enabled.
--    to_regclass guards keep this file runnable on a database that lacks one of them.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_price_book','ai_reservations','ai_usage_events','api_rate_limits','fx_rates','live_market_data',
    'sms_corrections','sms_keyword_pool','sms_promotion_config','sms_sender_currency','sms_sender_pool',
    'sms_template_signals','sms_template_users','sms_tracking_templates_ai','push_tokens'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Q11: privileges no PostgREST request ever uses, removed everywhere. TRUNCATE is not subject to RLS, so
--    `anon` holding TRUNCATE on expenses/debts/... was a one-request wipe if the anon key was ever combined with an
--    exposed RPC/SQL path. DML privileges of `authenticated` on the sync tables are NOT touched.
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Q11: `anon` (a signed-out browser with the public key) may read exactly two reference tables. Every other
--    policy is authenticated-only, so removing the rest changes no result a client can see; this only deletes the
--    privilege that RLS was the sole barrier for. If a cold-start regression shows (prices missing before the
--    session restores) the two GRANTs below are the contract; re-test asset prices and SMS merchant categories.
-- ---------------------------------------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.asset_prices, public.merchant_categories TO anon;

-- F9: the sweep above is one-time. Live pg_default_acl has `anon=arwdDxtm` (tables) and `anon=rwU` (sequences) for
-- objects created by postgres and supabase_admin in public, so the next CREATE TABLE would re-open anon. Stop that
-- (authenticated is left on purpose: new sync tables still need DML, RLS is their barrier). A table anon must read
-- needs an explicit GRANT in its own migration. supabase_admin's entry is wrapped: postgres may lack its membership.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'could not alter supabase_admin default privileges: run as supabase_admin';
END $$;

-- POST-APPLY CHECKS (expect): no pg_default_acl row for schema public grants anon (select defaclrole::regrole, defaclacl from pg_default_acl); anon has TRUNCATE nowhere; anon has SELECT on exactly {asset_prices, merchant_categories};
--   select table_name from information_schema.role_table_grants where table_schema='public' and grantee='anon' group by 1;
--   select count(*) from pg_policies where policyname in ('trusted_devices_self_insert','trusted_devices_self_update','sms_ingest_tokens_update_own','profiles_delete_own','user_settings_delete_own'); -- 0
--   Smoke: sign-in, sync pull/push, SMS parse, device trust (OTP), setup-token, biometric register, account delete.
