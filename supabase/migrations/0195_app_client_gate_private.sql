-- QA D5: app_client_gate() must not be callable by anon via /rest/v1/rpc. It stays the PostgREST pre-request hook
-- (0144), but moves to a schema that is not in db_schemas (public, graphql_public), so PostgREST never exposes it.
-- PostgREST runs the hook after switching to the request role (anon / authenticated / service_role), so those roles
-- keep USAGE on the schema and EXECUTE on the function. USAGE alone exposes nothing: only db_schemas are routed.
--
-- ROLLBACK (re-run 0144's app_client_gate definition in public, then):
--   ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.app_client_gate';
--   NOTIFY pgrst, 'reload config';
--   DROP FUNCTION IF EXISTS private.app_client_gate();
--
-- Note: the old public function is dropped in the same transaction as the repoint. PostgREST reloads config on the
-- NOTIFY, so for well under a second after commit a request can hit the old name and fail. Apply at a quiet moment
-- (or split the DROP into a second apply_migration call run a minute later).

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role, authenticator;

CREATE OR REPLACE FUNCTION private.app_client_gate() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE h jsonb; plat text; ver text; need text;
BEGIN
  BEGIN
    h := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
    plat := lower(coalesce(h->>'x-app-platform', ''));
    ver := nullif(h->>'x-app-version', '');
    IF plat = '' THEN
      IF coalesce(h->>'origin', '') NOT IN ('https://localhost', 'capacitor://localhost') THEN RETURN; END IF;
      plat := CASE WHEN coalesce(h->>'user-agent', '') ILIKE '%android%' THEN 'android' ELSE 'ios' END;
      ver := '0.0.0';
    END IF;
    IF plat NOT IN ('ios', 'android') THEN RETURN; END IF;
    SELECT value->>plat INTO need FROM public.platform_settings WHERE key = 'min_app_version';
    IF coalesce(need, '') = '' OR NOT public.app_version_below(coalesce(ver, '0.0.0'), need) THEN RETURN; END IF;
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  RAISE sqlstate 'PGRST' USING
    message = json_build_object('code', 'update_required', 'message', 'Update the Buddget app to continue.', 'min_version', need)::text,
    detail = json_build_object('status', 426, 'headers', json_build_object('X-Update-Required', 'true'))::text;
END $$;
REVOKE ALL ON FUNCTION private.app_client_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.app_client_gate() TO anon, authenticated, service_role, authenticator;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'private.app_client_gate';
NOTIFY pgrst, 'reload config';

DROP FUNCTION IF EXISTS public.app_client_gate();
