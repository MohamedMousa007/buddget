-- QA6 P3 closing (db-security): DBS-2 remainder, DBS-5, DBS-9, DBS-10, SST-8, SST-12.
-- STATUS: APPLIED LIVE (ydihurtbcnoflhormgzi). Additive tightening only: no row is read, rewritten or deleted.
-- DEPLOY NOTE (DBS-9): functions created from now on are NOT executable by anon/authenticated until the migration
--   that creates them says `GRANT EXECUTE ON FUNCTION ... TO authenticated` (the 11 intended client RPCs keep theirs).
-- ROLLBACK: GRANT SELECT ON biometric_devices TO authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
--   GRANT the table privileges below back; DROP TRIGGER the new link_guard_* / a1_pin_profile_email.

-- DBS-5: biometric_devices.secret_hash is read only by service-role routes; hide it from the owner's session.
REVOKE SELECT ON public.biometric_devices FROM authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ',' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'biometric_devices' AND column_name <> 'secret_hash';
  EXECUTE format('GRANT SELECT (%s) ON public.biometric_devices TO authenticated', cols);
END $$;

-- DBS-6: NOT FIXABLE FROM SQL. Schema `net` and its objects are owned by supabase_admin and the anon/authenticated/PUBLIC
-- USAGE and EXECUTE grants come from the platform (postgres has no grant option; SET ROLE supabase_admin is refused).
-- Exposure stays closed because PostgREST exposes only `public, graphql_public` (anon probe of `net` = PGRST106).

-- DBS-9: new functions are private by default. Per-schema default privileges can only ADD to the global default, so the
-- PUBLIC execute grant has to be removed globally; service_role keeps execute on everything postgres creates.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- (supabase_admin default privileges cannot be changed from the postgres role.)

-- DBS-10: lead and stats tables are service-role only.
REVOKE ALL ON public.site_leads, public.site_stats FROM anon, authenticated;

-- SST-8: no client write path exists for these (verified: src writes them with the service role only).
REVOKE INSERT, UPDATE, DELETE ON public.account_balance_reports, public.ai_chats, public.goal_allocation_runs,
  public.savings_month_summary FROM authenticated;
REVOKE UPDATE, DELETE ON public.app_analytics_events FROM authenticated;

-- DBS-2 remainder: assert_link_owner learns profiles (owner = id) and is attached to every other user-writable link.
CREATE OR REPLACE FUNCTION private.assert_link_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  i int := 0;
  col text; parent text; val text; ok boolean;
  owner_id uuid := (to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'profiles' THEN 'id' ELSE 'user_id' END)::uuid;
BEGIN
  WHILE i < TG_NARGS LOOP
    col := TG_ARGV[i]; parent := TG_ARGV[i + 1];
    val := to_jsonb(NEW) ->> col;
    IF val IS NOT NULL AND val <> '' THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1::uuid AND user_id = $2)', parent)
        INTO ok USING val, owner_id;
      IF NOT ok THEN
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1::uuid)', parent) INTO ok USING val;
        IF ok THEN
          RAISE EXCEPTION 'link %.% points at another user''s row', TG_TABLE_NAME, col USING ERRCODE = '23503';
        END IF;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END $function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('account_adjustments',     'payment_method_id,payment_methods'),
    ('buddgy_memories',         'plan_id,budget_plans'),
    ('budget_categories',       'plan_id,budget_plans'),
    ('budget_feedback',         'plan_id,budget_plans'),
    ('budget_plan_activations', 'plan_id,budget_plans'),
    ('budget_subcategories',    'category_id,budget_categories'),
    ('profiles',                'active_budget_plan_id,budget_plans,default_carry_pocket_id,savings_accounts'),
    ('expenses',                'payment_method_id,payment_methods,linked_debt_id,debts,linked_debt_payment_id,debt_payments,to_payment_method_id,payment_methods,linked_subscription_id,subscriptions,receipt_id,receipts,refund_sms_log_id,sms_parse_log')
  ) AS t(tbl, args) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS link_guard_%1$s ON public.%1$I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER link_guard_%1$s BEFORE INSERT OR UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.assert_link_owner(%2$s)',
      r.tbl, (SELECT string_agg(quote_literal(x), ',') FROM unnest(string_to_array(r.args, ',')) x));
  END LOOP;
END $$;

-- SST-12: a client session cannot point profiles.email at a third party; it always mirrors the Auth address.
-- Service-role, cron and direct connections (no authenticated/anon JWT) are not touched.
CREATE OR REPLACE FUNCTION private.pin_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  claim_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  auth_email text;
BEGIN
  IF claim_role IN ('authenticated', 'anon') THEN
    SELECT u.email INTO auth_email FROM auth.users u WHERE u.id = NEW.id;
    NEW.email := auth_email;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.pin_profile_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a1_pin_profile_email ON public.profiles;
CREATE TRIGGER a1_pin_profile_email BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.pin_profile_email();
