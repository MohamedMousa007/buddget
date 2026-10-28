-- Least-privilege database roles for the admin portal. They are NOLOGIN: they cannot be used until the owner gives one
-- a password and a direct connection string, so nothing in the app depends on them yet.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_reader') THEN CREATE ROLE portal_reader NOLOGIN CONNECTION LIMIT 5; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_actor') THEN CREATE ROLE portal_actor NOLOGIN CONNECTION LIMIT 5; END IF;
END $$;
ALTER ROLE portal_reader SET statement_timeout = '5s';
ALTER ROLE portal_reader SET lock_timeout = '2s';
ALTER ROLE portal_actor SET statement_timeout = '5s';
ALTER ROLE portal_actor SET lock_timeout = '2s';

GRANT USAGE ON SCHEMA public TO portal_reader, portal_actor;
GRANT SELECT ON public.admin_metrics_cache, public.ai_price_book, public.fx_rates, public.feature_flags TO portal_reader;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef AND (p.proname LIKE 'admin\_%' OR p.proname = 'support_submit')
             AND p.proname NOT IN ('admin_refresh_metrics', 'admin_rate_hit')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO portal_actor', f.sig);
  END LOOP;
END $$;

-- A ceiling for any request made with the service key (portal, webhooks, crons that go through the API). PostgREST
-- applies role settings per request. Scheduled jobs run as postgres and are unaffected.
ALTER ROLE service_role SET statement_timeout = '60s';
