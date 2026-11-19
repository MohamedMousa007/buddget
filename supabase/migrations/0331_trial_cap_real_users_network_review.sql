-- Round 2 runner fixes for 0330.
-- 1. Trial daily cap counts only real, live accounts: a claim whose account was deleted (user_id set null) or whose
--    address is on the reserved .test domain (QA accounts, RFC 2606; no real mailbox can confirm one) no longer
--    takes a slot. The claim row stays, so the mailbox still cannot claim twice. Bounded by trial_claims_day_idx
--    (today's rows, at most a few hundred) joined to auth.users on its primary key.
-- 2. repeat_network holds a friend for review only from the third friend of one inviter on one network in 30 days.
--    Two friends on one carrier NAT range or one campus Wi-Fi are common and legitimate (INVITE_ANTI_ABUSE.md).

create or replace function public.referral_redeem(p_user uuid, p_code text, p_device_id text default null,
                                       p_mailbox_key text default null, p_legacy_key text default null, p_ip text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := p_user; c record; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, ''))); v_id bigint; v_extended boolean := false;
  v_dev text := nullif(btrim(coalesce(p_device_id, '')), ''); v_mail text := private.mailbox_key(p_mailbox_key);
  v_legacy text := private.mailbox_key(p_legacy_key); v_net text; v_signals text[] := '{}';
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if not public.referrals_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  if length(v_code) > 40 then return jsonb_build_object('status', 'invalid_code'); end if;
  perform pg_advisory_xact_lock(hashtextextended('referral_redeem:' || u::text, 0));
  select user_id, created_at, owner_net into c from public.referral_codes where code = v_code;
  if not found then return jsonb_build_object('status', 'invalid_code'); end if;
  if c.user_id = u then return jsonb_build_object('status', 'self_invite'); end if;
  select created_at into v_created from auth.users where id = u;
  if v_created is null then raise exception 'not_authenticated'; end if;
  if v_created < c.created_at or v_created < now() - interval '7 days' then return jsonb_build_object('status', 'account_too_old'); end if;
  if exists (select 1 from public.referrals r where r.invitee_id = u)
     or (v_mail is not null and exists (select 1 from public.referrals r where r.invitee_mailbox in (v_mail, coalesce(v_legacy, v_mail)))) then
    return jsonb_build_object('status', 'already_redeemed');
  end if;
  if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = c.user_id and b.user_id = u)
     or (v_dev is not null and exists (select 1 from public.user_devices d where d.user_id = c.user_id and d.device_id = v_dev)) then
    return jsonb_build_object('status', 'self_invite');
  end if;
  if v_dev is not null and exists (select 1 from public.referrals r where r.device_id = v_dev and r.invitee_id is distinct from u) then
    insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at, status, reason, ended_at, invitee_mailbox)
    values (c.user_id, u, v_code, v_dev, v_created, 'rejected', 'device_used', now(), v_mail);
    return jsonb_build_object('status', 'device_used');
  end if;

  v_net := private.net_key(p_ip);
  if v_net is not null then
    if c.owner_net = v_net then v_signals := v_signals || 'inviter_network'::text; end if;
    if (select count(*) from (select 1 from public.referrals r where r.inviter_id = c.user_id and r.invitee_net = v_net and r.created_at > now() - interval '30 days' limit 2) x) >= 2 then
      v_signals := v_signals || 'repeat_network'::text;
    end if;
  end if;

  insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at, invitee_mailbox, invitee_net, review_signals)
  values (c.user_id, u, v_code, v_dev, v_created, v_mail, v_net, nullif(v_signals, '{}'))
  returning id into v_id;
  update public.referral_codes set invited_count = invited_count + 1 where user_id = c.user_id;
  update public.user_entitlements set trial_ends_at = trial_ends_at + interval '7 days', updated_at = now()
    where user_id = u and plan_key = 'plus_trial' and status = 'trialing' and trial_ends_at > now();
  v_extended := found;
  if v_extended then update public.referrals set trial_bonus_applied = true where id = v_id; end if;
  return jsonb_build_object('status', 'ok', 'trialExtended', v_extended);
exception when unique_violation then
  -- A parallel tap by the same account, or the same mailbox on another account, won the insert.
  return jsonb_build_object('status', 'already_redeemed');
end $$;
revoke all on function public.referral_redeem(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.referral_redeem(uuid, text, text, text, text, text) to service_role;

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
revoke all on function public.trial_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.trial_claim(uuid, text, text) to service_role;
