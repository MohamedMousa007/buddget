-- S8a B-17: trial_claim was keyed only on the mailbox. An ended trial leaves the plan row at source 'default', which
-- passes the already-entitled check, so changing the account's email gave a fresh 30 days, again and again.
-- Now an account that has any claim row gets already_claimed, and the claims table holds at most one row per account.
-- Pre-check on live, 2026-11-20: 347 claims, 0 accounts with more than one (the unique index builds cleanly).
-- Body is 0333's trial_claim with one added check; CREATE OR REPLACE keeps its service_role-only grant.

create or replace function public.trial_claim(p_user uuid, p_email_key text, p_legacy_key text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
  -- Owner, 2026-11-19: the trial is offered once per person, ever. A store plan (current or lapsed) or any Pro store event
  -- counts as used; only staff (admin_rewards_trial_start) can give another trial.
  if (v_ent.user_id is not null and (v_ent.source in ('apple', 'google') or v_ent.store_original_txn is not null))
     or exists (select 1 from public.billing_events b where b.user_id = p_user and b.product_id like 'pro%') then
    return jsonb_build_object('status', 'already_claimed');
  end if;
  -- S8a B-17: one trial per account too, so a new email on the same account is not a new person.
  if exists (select 1 from public.trial_claims where user_id = p_user) then
    return jsonb_build_object('status', 'already_claimed');
  end if;
  select coalesce((value ->> 'dailyCap')::integer, 200) into v_cap from public.platform_settings where key = 'trial_limits';
  select count(*) into v_n from public.trial_claims t join auth.users u on u.id = t.user_id
  where t.claimed_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' and lower(u.email) not like '%.test';
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
end $$;

create unique index if not exists trial_claims_user_uidx on public.trial_claims (user_id) where user_id is not null;
drop index if exists public.trial_claims_user_idx;

revoke all on function public.trial_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.trial_claim(uuid, text, text) to service_role;
