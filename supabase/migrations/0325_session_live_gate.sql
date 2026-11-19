-- QA-30: a revoked session (phone removed, signed out elsewhere, password change) kept PostgREST
-- access until its access JWT expired. db_pre_request now refuses a JWT whose session_id has no
-- auth.sessions row (401 session_revoked).
-- Cost: one index-only scan on sessions_pkey per authenticated PostgREST request
--   (EXPLAIN 2026-11-19: "Index Only Scan using sessions_pkey on sessions (cost=0.14..1.26 rows=1)").
-- No settings read. Fails open on any unexpected error, so an Auth-schema problem cannot lock users out.
-- Tokens without a session_id claim (service role, anon, custom tooling) are not affected.
-- Kill switch, no deploy needed:  alter role authenticator set app.session_gate = 'off'; notify pgrst, 'reload config';

create or replace function private.session_live_gate()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare claims jsonb; sid uuid; live boolean;
begin
  begin
    if current_setting('app.session_gate', true) = 'off' then return; end if;
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    if claims is null or claims->>'role' is distinct from 'authenticated' then return; end if;
    sid := nullif(claims->>'session_id', '')::uuid;
    if sid is null then return; end if;
    live := exists (select 1 from auth.sessions where id = sid);
  exception when others then
    return;
  end;
  if live then return; end if;
  raise sqlstate 'PGRST' using
    message = json_build_object('code', 'session_revoked', 'message', 'This session has ended. Sign in again.')::text,
    detail = json_build_object('status', 401, 'headers', json_build_object())::text;
end $function$;

revoke all on function private.session_live_gate() from public, anon, authenticated;

create or replace function private.db_pre_request()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
begin
  perform private.app_client_gate();
  perform private.session_live_gate();
  perform private.two_factor_gate();
end $function$;

do $$
begin
  assert pg_get_functiondef('private.db_pre_request()'::regprocedure) ilike '%session_live_gate%', 'session gate not wired';
  assert pg_get_functiondef('private.db_pre_request()'::regprocedure) ilike '%two_factor_gate%', '2FA gate no longer wired';
end $$;
