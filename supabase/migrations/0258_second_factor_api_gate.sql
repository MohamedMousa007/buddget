-- AUT-1 follow-up: the same second-factor decision the PostgREST gate makes (0208), callable by the app server so /api/* routes
-- can refuse a password-only session of a 2-step user. Service role only. Pure read; changes no data.
-- ROLLBACK: drop function public.second_factor_verified(uuid, uuid, jsonb);
create or replace function public.second_factor_verified(p_user uuid, p_session uuid, p_amr jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  cfg jsonb; mode text; has2fa boolean;
begin
  select value into cfg from public.platform_settings where key = 'enforce_2fa_gate';
  mode := coalesce(cfg->>'mode', 'off');
  if mode <> 'enforce' then return true; end if;
  if jsonb_typeof(cfg->'only_users') = 'array' and not ((cfg->'only_users') ? p_user::text) then return true; end if;
  select coalesce(two_factor_email_enabled, false) into has2fa from public.user_settings where user_id = p_user;
  if not coalesce(has2fa, false) then return true; end if;
  return private.session_second_factor_ok(p_session, mode, cfg, jsonb_build_object('amr', coalesce(p_amr, '[]'::jsonb)));
end $$;
revoke all on function public.second_factor_verified(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.second_factor_verified(uuid, uuid, jsonb) to service_role;
