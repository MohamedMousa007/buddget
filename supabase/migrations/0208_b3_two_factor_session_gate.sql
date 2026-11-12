-- 0208 B3 / C1: server-side email 2FA gate. APPLIED LIVE. ENFORCE armed 2026-11-12 for all users (grandfather_before stamped: sessions older than that keep working).
-- Break glass: select private.set_2fa_gate('off', null);
--
-- Design (docs/qa-round-2/PLAN_REVIEW_A.md #7, PLAN_REVIEW_B.md #6):
--  * A SEPARATE function, private.two_factor_gate(), never inside the fail-open private.app_client_gate().
--    Block A (is this request subject to the gate?) fails OPEN; block B (is this 2FA user's session verified?)
--    fails CLOSED in enforce mode and is log-only in report mode.
--  * Flag: platform_settings.enforce_2fa_gate = {"mode": "off"|"report"|"enforce", "only_users": [uuid]?,
--    "grandfather_before": timestamptz?, "oauth_counts": bool?}. Default {"mode":"off"}: nothing changes.
--  * Verified means, for a user with user_settings.two_factor_email_enabled:
--      - the session was created before grandfather_before (existing sessions keep working), or
--      - a row in private.session_second_factor exists for the JWT session_id (trusted device, enabled-here), or
--      - the JWT amr records a one-time-code sign-in (email OTP 2FA and the biometric sign-in, which redeems an OTP), or
--      - oauth_counts (default true) and the amr records an identity-provider sign-in.
--    A password-only session of a 2FA user is the only thing refused.
--  * Existing sessions: arm with private.set_2fa_gate('enforce'), which stamps grandfather_before = now().
--    With mode enforce and no grandfather_before nothing is enforced (safe default).
--  * Allow-list: /rpc/second_factor_status. The OTP step itself runs through Auth + /api routes (service role),
--    which this PostgREST hook never gates (role must be 'authenticated').
--  * Turning 2FA off over PostgREST (own-row RLS update) is reverted by trigger while the gate is not 'off';
--    the /api/auth/two-factor route (service role, re-auth) is the only way.
--
-- (Historic note, resolved: the client now routes the 403 to SecondFactorGate, resumes sync, and closes the challenge once device/check marks a trusted session.) Was blocked (F4/F6): nothing in src/ handles the 403 'second_factor_required' / X-Second-Factor-Required answer or calls
-- second_factor_status, and the trusted-device mark is written by /api/auth/device/check which the client calls after
-- sign-in (a PostgREST call that races ahead is refused). Do not go past 'report' until a shipped build (a) routes that
-- 403 to the OTP step, (b) awaits device/check before its first sync, and (c) surfaces record_second_factor recorded:false.
-- A recovery-link session also passes the gate (amr recovery/magiclink: inbox proof, accepted).
-- ROLLBACK (exact): alter role authenticator set pgrst.db_pre_request = 'private.app_client_gate'; notify pgrst, 'reload config';
--   then optionally: drop trigger guard_two_factor_flag on public.user_settings; and drop the private.two_factor_gate / db_pre_request functions.
--
-- Rollout: (1) deploy code, (2) apply this file (nothing changes: db_pre_request is repointed but mode is off),
-- (3) select private.set_2fa_gate('report', '["<owner uuid>"]'), read postgres logs for '2fa_gate would_block',
-- (4) select private.set_2fa_gate('enforce', '["<owner uuid>"]') after a shipped build sends the proof,
-- (5) widen: select private.set_2fa_gate('enforce', null). Rollback: select private.set_2fa_gate('off', null).
-- 0216 (fast gate) must start from pg_get_functiondef of app_client_gate and keep the wrapper below.

create table if not exists private.session_second_factor (
  session_id  uuid primary key references auth.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  method      text not null check (method in ('otp', 'trusted_device', 'biometric', 'enabled_here')),
  verified_at timestamptz not null default now()
);
create index if not exists session_second_factor_user_idx on private.session_second_factor (user_id);
alter table private.session_second_factor enable row level security;
revoke all on private.session_second_factor from public, anon, authenticated;

insert into public.platform_settings (key, value)
values ('enforce_2fa_gate', '{"mode":"off"}'::jsonb)
on conflict (key) do nothing;

create or replace function public.record_second_factor(p_session uuid, p_user uuid, p_method text)
returns void
language sql
security definer
set search_path = private, public, pg_temp
as $$
  insert into private.session_second_factor (session_id, user_id, method)
  select s.id, s.user_id, p_method from auth.sessions s where s.id = p_session and s.user_id = p_user
  on conflict (session_id) do update set method = excluded.method, verified_at = now();
$$;
revoke all on function public.record_second_factor(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_second_factor(uuid, uuid, text) to service_role;

create or replace function private.session_second_factor_ok(p_sid uuid, p_mode text, p_cfg jsonb, p_claims jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  gf timestamptz := nullif(p_cfg->>'grandfather_before', '')::timestamptz;
  created timestamptz;
begin
  if p_sid is null then return false; end if;
  if gf is null then
    if p_mode = 'enforce' then return true; end if;
    gf := '-infinity';
  end if;
  select created_at into created from auth.sessions where id = p_sid;
  if created is null then return false; end if;
  if created < gf then return true; end if;
  if exists (select 1 from private.session_second_factor where session_id = p_sid) then return true; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_claims->'amr', '[]'::jsonb)) a
    where a->>'method' in ('otp', 'magiclink', 'email/signup', 'recovery')
  ) then return true; end if;
  if coalesce((p_cfg->>'oauth_counts')::boolean, true) and exists (
    select 1 from jsonb_array_elements(coalesce(p_claims->'amr', '[]'::jsonb)) a
    where a->>'method' in ('oauth', 'id_token', 'sso/saml')
  ) then return true; end if;
  return false;
end $$;
revoke all on function private.session_second_factor_ok(uuid, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.two_factor_gate()
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  cfg jsonb; mode text; claims jsonb; uid uuid; sid uuid; path text; has2fa boolean; ok boolean;
begin
  -- Block A, fail open: is this request subject to the gate at all?
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    if claims is null or claims->>'role' is distinct from 'authenticated' then return; end if;
    select value into cfg from public.platform_settings where key = 'enforce_2fa_gate';
    mode := coalesce(cfg->>'mode', 'off');
    if mode not in ('report', 'enforce') then return; end if;
    uid := (claims->>'sub')::uuid;
    if jsonb_typeof(cfg->'only_users') = 'array' and not ((cfg->'only_users') ? uid::text) then return; end if;
    path := coalesce(current_setting('request.path', true), '');
    if path like '%/rpc/second_factor_status' then return; end if;
    select coalesce(two_factor_email_enabled, false) into has2fa from public.user_settings where user_id = uid;
    if not coalesce(has2fa, false) then return; end if;
  exception when others then
    return;
  end;

  -- Block B, fail closed in enforce mode (log only in report mode).
  begin
    sid := nullif(claims->>'session_id', '')::uuid;
    ok := private.session_second_factor_ok(sid, mode, cfg, claims);
  exception when others then
    if mode = 'enforce' then raise; end if;
    return;
  end;
  if ok then return; end if;
  if mode = 'report' then
    raise log '2fa_gate would_block user=% session=% path=%', uid, sid, path;
    return;
  end if;
  raise sqlstate 'PGRST' using
    message = json_build_object('code', 'second_factor_required', 'message', 'Verify your second factor to continue.')::text,
    detail = json_build_object('status', 403, 'headers', json_build_object('X-Second-Factor-Required', 'true'))::text;
end $$;
revoke all on function private.two_factor_gate() from public, anon, authenticated;

create or replace function public.second_factor_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  uid uuid := auth.uid();
  cfg jsonb;
  has2fa boolean;
begin
  select value into cfg from public.platform_settings where key = 'enforce_2fa_gate';
  select coalesce(two_factor_email_enabled, false) into has2fa from public.user_settings where user_id = uid;
  return jsonb_build_object(
    'mode', coalesce(cfg->>'mode', 'off'),
    'twoFactor', coalesce(has2fa, false),
    'verified', private.session_second_factor_ok(nullif(claims->>'session_id', '')::uuid, 'report', cfg, claims)
  );
end $$;
revoke all on function public.second_factor_status() from public, anon;
grant execute on function public.second_factor_status() to authenticated;

-- Owner-run switch. Moving to enforce stamps the grandfather cut-off so sessions that exist now keep working.
create or replace function private.set_2fa_gate(p_mode text, p_only_users jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  cur jsonb; nxt jsonb;
begin
  if p_mode not in ('off', 'report', 'enforce') then raise exception 'mode must be off, report or enforce'; end if;
  select value into cur from public.platform_settings where key = 'enforce_2fa_gate';
  nxt := coalesce(cur, '{}'::jsonb) || jsonb_build_object('mode', p_mode);
  if p_only_users is null then nxt := nxt - 'only_users'; else nxt := nxt || jsonb_build_object('only_users', p_only_users); end if;
  if p_mode = 'enforce' and coalesce(cur->>'mode', 'off') <> 'enforce' then
    nxt := nxt || jsonb_build_object('grandfather_before', now());
  end if;
  insert into public.platform_settings (key, value) values ('enforce_2fa_gate', nxt)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return nxt;
end $$;
revoke all on function private.set_2fa_gate(text, jsonb) from public, anon, authenticated;

-- One pre-request hook calling both gates. app_client_gate keeps its fail-open behaviour untouched.
create or replace function private.db_pre_request()
returns void
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.app_client_gate();
  perform private.two_factor_gate();
end $$;
grant execute on function private.db_pre_request() to authenticator, anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'private.db_pre_request';
notify pgrst, 'reload config';

-- A PostgREST write cannot switch 2FA off while the gate is armed; the re-auth route (service role) can.
create or replace function private.guard_two_factor_flag()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  role_claim text := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
begin
  if coalesce(old.two_factor_email_enabled, false) and not coalesce(new.two_factor_email_enabled, false)
     and role_claim = 'authenticated'
     and coalesce((select value->>'mode' from public.platform_settings where key = 'enforce_2fa_gate'), 'off') <> 'off'
  then
    new.two_factor_email_enabled := true;
  end if;
  return new;
end $$;
revoke all on function private.guard_two_factor_flag() from public, anon, authenticated;
drop trigger if exists guard_two_factor_flag on public.user_settings;
create trigger guard_two_factor_flag
  before update of two_factor_email_enabled on public.user_settings
  for each row execute function private.guard_two_factor_flag();
