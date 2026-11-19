-- QA-59: trial_claims.email_key held the normalised address in clear and survives account
-- deletion (one trial per mailbox). Store a hash instead:
--   * an address handed in (contains '@') is stored as sha256 hex, so no plaintext is kept even
--     before the server secret exists, and the route deployed before this file keeps working;
--   * once TRIAL_CLAIM_KEY_SECRET is set in Vercel, the route sends an HMAC key plus the plain
--     key as p_legacy_key; a row stored under sha256(plain) is converted to the HMAC key, so a
--     mailbox that claimed before the secret still gets 'already_claimed'.
-- Backfill: every existing row (137 on 2026-11-19, all plaintext) becomes sha256 hex. Safe to run
-- again (hashed keys contain no '@').

update public.trial_claims
set email_key = encode(extensions.digest(email_key, 'sha256'), 'hex')
where email_key like '%@%';

drop function if exists public.trial_claim(uuid, text);

create function public.trial_claim(p_user uuid, p_email_key text, p_legacy_key text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_days integer; v_end timestamptz; v_cap integer; v_n integer; v_ent public.user_entitlements%rowtype; v_ref bigint;
  v_key text; v_legacy text;
begin
  if p_email_key is null or length(p_email_key) < 3 then return jsonb_build_object('status', 'invalid_email'); end if;
  if not public.billing_enabled() then return jsonb_build_object('status', 'billing_off'); end if;
  v_key := case when p_email_key like '%@%' then encode(extensions.digest(p_email_key, 'sha256'), 'hex') else p_email_key end;
  v_legacy := case when p_legacy_key like '%@%' then encode(extensions.digest(p_legacy_key, 'sha256'), 'hex') end;
  perform pg_advisory_xact_lock(hashtextextended('trial:' || p_user::text, 0));
  if v_legacy is not null and v_legacy <> v_key then
    update public.trial_claims set email_key = v_key
    where email_key = v_legacy and not exists (select 1 from public.trial_claims where email_key = v_key);
  end if;
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and v_ent.source <> 'default' and (
       (v_ent.status = 'active' and (v_ent.current_period_end is null or v_ent.current_period_end > now()))
    or (v_ent.status = 'trialing' and (v_ent.trial_ends_at is null or v_ent.trial_ends_at > now()))
    or v_ent.status in ('canceled', 'past_due', 'paused')
  ) then return jsonb_build_object('status', 'already_entitled'); end if;
  select coalesce((value ->> 'dailyCap')::integer, 200) into v_cap from public.platform_settings where key = 'trial_limits';
  select count(*) into v_n from public.trial_claims where claimed_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if v_n >= coalesce(v_cap, 200) then return jsonb_build_object('status', 'daily_cap'); end if;
  insert into public.trial_claims (email_key, user_id) values (v_key, p_user) on conflict (email_key) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('status', 'already_claimed'); end if;
  select trial_days into v_days from public.plans where key = 'plus_trial';
  select id into v_ref from public.referrals where invitee_id = p_user and not trial_bonus_applied and status in ('pending', 'activated', 'rewarded', 'capped');
  v_end := now() + make_interval(days => coalesce(v_days, 30) + case when v_ref is not null then 7 else 0 end);
  if v_ref is not null then update public.referrals set trial_bonus_applied = true where id = v_ref; end if;
  insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, current_period_end, note)
  values (p_user, 'plus_trial', 'trialing', 'default', v_end, null, 'S6: 30-day trial')
  on conflict (user_id) do update
    set plan_key = 'plus_trial', status = 'trialing', source = 'default', trial_ends_at = v_end, current_period_end = null,
        canceled_at = null, note = 'S6: 30-day trial', updated_at = now();
  return jsonb_build_object('status', 'granted', 'trial_ends_at', v_end, 'invited', v_ref is not null);
end;
$function$;

revoke all on function public.trial_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.trial_claim(uuid, text, text) to service_role;

do $$
begin
  assert not exists (select 1 from public.trial_claims where email_key like '%@%'), 'plaintext email_key remains';
end $$;
