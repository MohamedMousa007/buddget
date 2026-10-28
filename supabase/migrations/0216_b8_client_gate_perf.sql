-- 0216 B8 / F10: private.app_client_gate fast path. NOT APPLIED. Separate from 0215 for easy revert.
-- Audit: the live pre-request hook is private.db_pre_request() = perform private.app_client_gate(); perform private.two_factor_gate();
--   (0208, applied). The 2FA gate is its OWN function and is NOT touched here: its block-A fail-open / block-B fail-closed
--   semantics, and db_pre_request, are unchanged. Only app_client_gate (fail-open, min_app_version) is rewritten.
-- Live body (pg_get_functiondef) is preserved VERBATIM as the slow path. Added: a fast exit before the BEGIN..EXCEPTION
-- block (each entry into that block opens a subtransaction, and a normal web request never needed it).
-- Equivalence: the original returns early unless (x-app-platform header present) or (origin is https://localhost or
-- capacitor://localhost). PostgREST lower-cases header names and emits them as JSON keys, so if the lower-cased raw
-- headers text contains neither 'x-app-platform' nor 'localhost', the original always reached RETURN (plat='' and origin
-- not a native origin; unparsable/empty headers also RETURN via the exception handler). Any false positive just takes the slow path.
-- Same signature, same SECURITY DEFINER / STABLE / search_path. min_app_version logic and the 426 error are the live text.
-- Rollback: re-apply the live definition (without the fast-exit lines).
CREATE OR REPLACE FUNCTION private.app_client_gate()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE h jsonb; plat text; ver text; need text; raw text;
BEGIN
  raw := lower(coalesce(current_setting('request.headers', true), ''));
  IF position('x-app-platform' in raw) = 0 AND position('localhost' in raw) = 0 THEN RETURN; END IF;
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
END $function$;

-- Assertions: web request passes; native below min (forced via a temp-free check on the pure helper) still blocks.
DO $$
BEGIN
  PERFORM set_config('request.headers', '{"origin":"https://app.example.com","user-agent":"x"}', true);
  PERFORM private.app_client_gate();
  PERFORM set_config('request.headers', '', true);
  PERFORM private.app_client_gate();
  ASSERT pg_get_functiondef('private.app_client_gate()'::regprocedure) ILIKE '%raw := lower%', 'fast path missing';
  ASSERT pg_get_functiondef('private.db_pre_request()'::regprocedure) ILIKE '%two_factor_gate%', '2FA gate no longer wired';
  ASSERT public.app_version_below('1.0.0', '2.0.0') AND NOT public.app_version_below('2.0.0', '2.0.0'), 'version compare';
END $$;
