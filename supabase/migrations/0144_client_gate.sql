-- Force-update gate for the native apps, enforced where the data is: PostgREST calls this before EVERY request.
-- The minimum is the one admins set in Platform > Minimum app version (platform_settings 'min_app_version'), so there is
-- nothing new to operate. Releases that predate the gate send no version header; they are recognised by the native
-- WebView origin and treated as 0.0.0, so raising the minimum cuts them off even though they cannot show a popup.
-- Safety: any problem inside this function lets the request through (it can never take the API down), only a deliberate
-- "update required" is raised, and it answers HTTP 426. Web and server-to-server requests return before any lookup.

CREATE OR REPLACE FUNCTION public.app_version_below(p_version text, p_min text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE a int[]; b int[]; i int; d int;
BEGIN
  IF p_min IS NULL OR p_min = '' THEN RETURN false; END IF;
  a := string_to_array(coalesce(nullif(p_version, ''), '0'), '.')::int[];
  b := string_to_array(p_min, '.')::int[];
  FOR i IN 1..greatest(coalesce(array_length(a, 1), 0), coalesce(array_length(b, 1), 0)) LOOP
    d := coalesce(a[i], 0) - coalesce(b[i], 0);
    IF d <> 0 THEN RETURN d < 0; END IF;
  END LOOP;
  RETURN false;
EXCEPTION WHEN others THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.app_client_gate() RETURNS void
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
    SELECT value->>plat INTO need FROM platform_settings WHERE key = 'min_app_version';
    IF coalesce(need, '') = '' OR NOT app_version_below(coalesce(ver, '0.0.0'), need) THEN RETURN; END IF;
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  RAISE sqlstate 'PGRST' USING
    message = json_build_object('code', 'update_required', 'message', 'Update the Buddget app to continue.', 'min_version', need)::text,
    detail = json_build_object('status', 426, 'headers', json_build_object('X-Update-Required', 'true'))::text;
END $$;
REVOKE ALL ON FUNCTION public.app_client_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_client_gate() TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION public.app_version_below(text, text) TO anon, authenticated, service_role, authenticator;
