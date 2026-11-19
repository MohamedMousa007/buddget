-- QA round 2 fixes for Rewards, Invite, billing and API security (docs/qa/round2/S8g-pro-rewards.md, S8c-api-security.md).
-- Invite anti-abuse design: docs/launch/INVITE_ANTI_ABUSE.md.
-- Pre-checks on live, 2026-11-19: referrals 0 rows; 0 rows violating any CHECK added below; 7 accounts without a loyalty row.

-- ============================================================ keys (pepper never leaves the database)
create table if not exists private.referral_pepper (
  id boolean primary key default true check (id),
  pepper bytea not null default extensions.gen_random_bytes(32)
);
insert into private.referral_pepper default values on conflict do nothing;
revoke all on private.referral_pepper from public, anon, authenticated;

-- The trial's mailbox key (trial_claim): a keyed hash from the app, or SHA-256 of the plain normalised address.
create or replace function private.mailbox_key(p_key text)
returns text language sql immutable set search_path to '' as $$
  select case when nullif(p_key, '') is null then null
              when p_key like '%@%' then encode(extensions.digest(p_key, 'sha256'), 'hex') else p_key end
$$;

-- A network (IPv4 /24, IPv6 /48) as an HMAC with the pepper. Null for junk or a missing address.
create or replace function private.net_key(p_ip text)
returns text language plpgsql stable security definer set search_path to '' as $$
declare v inet;
begin
  if nullif(btrim(coalesce(p_ip, '')), '') is null then return null; end if;
  v := btrim(p_ip)::inet;
  if family(v) = 6 and host(v) ~ '^::ffff:\d+\.\d+\.\d+\.\d+$' then v := substring(host(v) from 8)::inet; end if;
  v := network(set_masklen(v, case when family(v) = 4 then 24 else 48 end));
  return encode(extensions.hmac(convert_to(host(v), 'UTF8'), (select pepper from private.referral_pepper), 'sha256'), 'hex');
exception when others then
  return null;
end $$;

-- The caller's address as the Cloudflare edge in front of PostgREST saw it.
create or replace function private.request_ip()
returns text language plpgsql stable set search_path to '' as $$
begin
  return nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip';
exception when others then
  return null;
end $$;
revoke all on function private.mailbox_key(text), private.net_key(text), private.request_ip() from public, anon, authenticated;

-- ============================================================ referrals: columns and indexes
alter table public.referrals
  add column if not exists invitee_mailbox text,
  add column if not exists invitee_net text,
  add column if not exists review_signals text[];
alter table public.referral_codes add column if not exists owner_net text;

create unique index if not exists referrals_invitee_mailbox_key on public.referrals (invitee_mailbox) where invitee_mailbox is not null;
create index if not exists referrals_inviter_net_idx on public.referrals (inviter_id, invitee_net, created_at) where invitee_net is not null;
create index if not exists referrals_net_retention_idx on public.referrals (created_at) where invitee_net is not null;
create index if not exists referrals_held_idx on public.referrals (id) where status = 'activated' and reason = 'awaiting_native';
create index if not exists user_devices_device_idx on public.user_devices (device_id);

-- ============================================================ S8G-14, S8G-05, S8G-06: redeem (service-only; POST /api/referrals/redeem)
drop function if exists public.referral_redeem(text, text);
create function public.referral_redeem(p_user uuid, p_code text, p_device_id text default null,
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
    if exists (select 1 from public.referrals r where r.inviter_id = c.user_id and r.invitee_net = v_net and r.created_at > now() - interval '30 days') then
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

-- ============================================================ inviter's network, stamped when they open the Invite page
create or replace function public.referral_my_summary()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); v_code text; rc public.referral_codes%rowtype; v_month integer; v_year integer; v_net text;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  v_code := public.referral_ensure_code(u);
  v_net := private.net_key(private.request_ip());
  if v_net is not null then update public.referral_codes set owner_net = v_net where user_id = u and owner_net is distinct from v_net; end if;
  select * into rc from public.referral_codes where user_id = u;
  select count(*) filter (where rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'), count(*) into v_month, v_year
    from public.referrals where inviter_id = u and status = 'rewarded' and rewarded_at >= date_trunc('year', now() at time zone 'UTC') at time zone 'UTC';
  return jsonb_build_object(
    'enabled', public.referrals_enabled(),
    'code', v_code,
    'link', 'https://buddget.app/i/' || v_code,
    'counts', jsonb_build_object('invited', rc.invited_count, 'activated', rc.activated_count, 'rewarded', rc.rewards_count),
    'caps', jsonb_build_object('month', 4, 'year', 12, 'monthUsed', v_month, 'yearUsed', v_year),
    'rewards', jsonb_build_object(
      'proDaysEarned', coalesce((select sum(days) from public.pro_promo_grants where user_id = u and source = 'referral' and revoked_at is null), 0),
      'proDaysBanked', coalesce((select sum(days) from public.pro_promo_grants where user_id = u and started_at is null and revoked_at is null), 0),
      'sparksEarned', coalesce((select sum(granted) from public.spark_allowances where user_id = u and kind = 'reward' and ref like 'referral:%'), 0)),
    'milestones', jsonb_build_array(
      jsonb_build_object('friends', 3, 'kind', 'points', 'amount', 50, 'reached', rc.activated_count >= 3),
      jsonb_build_object('friends', 5, 'kind', 'points', 'amount', 100, 'reached', rc.activated_count >= 5),
      jsonb_build_object('friends', 10, 'kind', 'card_finish', 'item', 'connector', 'reached', rc.activated_count >= 10)),
    'friends', coalesce((select jsonb_agg(f order by f.joined_at desc) from (
      select r.id, nullif(split_part(btrim(coalesce(nullif(p.display_name, ''), p.name, '')), ' ', 1), '') as name, r.created_at as joined_at, r.status,
             r.active_days, 3 as active_days_needed, r.tx_count as transactions, 5 as transactions_needed,
             r.invitee_created_at + interval '14 days' as window_ends_at, r.reward_kind
      from public.referrals r left join public.profiles p on p.id = r.invitee_id
      where r.inviter_id = u order by r.created_at desc limit 50) f), '[]'::jsonb)
  );
end $$;

-- ============================================================ S8G-13: evaluation locks the rows it plans for, and retries held rows
create or replace function public.referral_evaluate(p_invitee uuid default null, p_limit integer default 500)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_ids bigint[]; v_held bigint[]; v_id bigint;
begin
  if not public.referrals_enabled() then return 0; end if;
  -- One bulk run at a time: two overlapping runs would take per-inviter locks in different orders (deadlock).
  if p_invitee is null and not pg_try_advisory_xact_lock(hashtextextended('referral_evaluate:bulk', 0)) then return 0; end if;
  with c as (
    select r.id, r.invitee_id, r.invitee_created_at, r.active_days, r.tx_count, coalesce(nullif(us.timezone, ''), 'UTC') tz
    from public.referrals r left join public.user_settings us on us.user_id = r.invitee_id
    where r.status = 'pending' and r.invitee_id is not null and (p_invitee is null or r.invitee_id = p_invitee)
    order by r.id limit p_limit
    for update of r skip locked
  ), recs as (
    select c.id, e.created_at from c join public.expenses e on e.user_id = c.invitee_id and e.deleted_at is null
      and e.created_at < c.invitee_created_at + interval '14 days'
    union all
    select c.id, i.created_at from c join public.income_events i on i.user_id = c.invitee_id and i.deleted_at is null
      and i.created_at < c.invitee_created_at + interval '14 days'
  ), s as (
    select c.id, c.active_days, c.tx_count, count(recs.created_at)::integer tx,
           count(distinct public.loyalty_local_day(recs.created_at, c.tz))::integer days,
           now() >= c.invitee_created_at + interval '14 days' as closed
    from c left join recs on recs.id = c.id group by c.id, c.active_days, c.tx_count, c.tz, c.invitee_created_at
  ), n as (
    select s.*, case when s.days >= 3 and s.tx >= 5 then 'activated' when s.closed then 'expired' else 'pending' end as next_status from s
  ), u as (
    update public.referrals r set
      active_days = least(n.days, 32767), tx_count = least(n.tx, 32767), status = n.next_status,
      activated_at = case when n.next_status = 'activated' then now() else r.activated_at end,
      ended_at = case when n.next_status = 'expired' then now() else r.ended_at end
    from n where r.id = n.id and r.status = 'pending' and (n.next_status <> 'pending' or n.days <> n.active_days or n.tx <> n.tx_count)
    returning r.id, r.status
  )
  select coalesce(array_agg(id), '{}') into v_ids from u where status = 'activated';

  -- Friends who did their part on the web: paid once they sign in on a phone (docs/launch/INVITE_ANTI_ABUSE.md).
  select coalesce(array_agg(h.id), '{}') into v_held from (
    select r.id from public.referrals r
    where r.status = 'activated' and r.reason = 'awaiting_native' and (p_invitee is null or r.invitee_id = p_invitee)
    order by r.id limit p_limit
    for update skip locked) h;

  foreach v_id in array v_ids || v_held loop
    perform public.referral_reward(v_id, false);
  end loop;

  if p_invitee is null then
    update public.referrals set invitee_net = null where invitee_net is not null and created_at < now() - interval '90 days';
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end $$;

-- The friend's app open (/api/entitlements/me) also retries a friend held for a native sign-in.
create or replace function public.rewards_touch(p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.referrals where invitee_id = p_user
             and (status = 'pending' or (status = 'activated' and reason = 'awaiting_native'))) then
    perform public.referral_evaluate(p_user, 1);
  end if;
  if exists (select 1 from public.pro_promo_grants where user_id = p_user and started_at is null and revoked_at is null) then
    perform public.promo_apply_banked(p_user);
  end if;
  perform public.loyalty_refresh_tier(p_user);
end $$;

-- ============================================================ S8G-05: native gate, one reward per device, manual review
create or replace function public.referral_reward(p_id bigint, p_force boolean default false)
returns text language plpgsql security definer set search_path to 'public' as $$
declare r public.referrals%rowtype; v_month integer; v_year integer; v_act integer; e record; v_store boolean;
begin
  select * into r from public.referrals where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.inviter_id is null or r.invitee_id is null then return r.status; end if;
  if not (r.status = 'activated' or (p_force and r.status in ('capped', 'rejected', 'pending', 'expired'))) then return r.status; end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || r.inviter_id::text, 0));

  if not p_force then
    if not exists (select 1 from public.user_devices d where d.user_id = r.invitee_id and d.platform in ('ios', 'android') and d.revoked_at is null) then
      if now() >= r.invitee_created_at + interval '30 days' then
        update public.referrals set status = 'expired', reason = 'no_native_device', ended_at = now() where id = p_id;
        return 'expired';
      end if;
      if r.reason is distinct from 'awaiting_native' then update public.referrals set reason = 'awaiting_native' where id = p_id; end if;
      return 'held';
    end if;
    if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = r.inviter_id and b.user_id = r.invitee_id) then
      update public.referrals set status = 'rejected', reason = 'self_device', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
    -- One reward per device: the device brought a friend before (its id on a referral), or another account on it is a rewarded or in-flight friend.
    if exists (select 1 from public.user_devices d join public.referrals o on o.device_id = d.device_id
               where d.user_id = r.invitee_id and o.id <> r.id and o.status in ('activated', 'rewarded', 'capped'))
       or exists (select 1 from public.user_devices d join public.user_devices d2 on d2.device_id = d.device_id and d2.user_id <> d.user_id
                  join public.referrals o on o.invitee_id = d2.user_id
                  where d.user_id = r.invitee_id and o.id <> r.id and o.status in ('activated', 'rewarded', 'capped')) then
      update public.referrals set status = 'rejected', reason = 'device_used', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
    if cardinality(r.review_signals) > 0 then
      if r.reason is distinct from 'review' then update public.referrals set reason = 'review' where id = p_id; end if;
      return 'held';
    end if;
  end if;

  if r.status = 'activated' or (p_force and r.status in ('pending', 'expired')) then
    update public.referral_codes set activated_count = activated_count + 1 where user_id = r.inviter_id returning activated_count into v_act;
    if r.activated_at is null then update public.referrals set activated_at = now() where id = p_id; end if;
    if v_act = 3 then perform public.loyalty_award(r.inviter_id, 50, 'referral_milestone', '3'); end if;
    if v_act = 5 then perform public.loyalty_award(r.inviter_id, 100, 'referral_milestone', '5'); end if;
    if v_act = 10 then insert into public.loyalty_owned_items (user_id, kind, item_key, source) values (r.inviter_id, 'card_finish', 'connector', 'milestone') on conflict do nothing; end if;
  end if;

  if not p_force then
    select count(*) filter (where rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'), count(*)
      into v_month, v_year
      from public.referrals where inviter_id = r.inviter_id and status = 'rewarded' and rewarded_at >= date_trunc('year', now() at time zone 'UTC') at time zone 'UTC';
    if v_month >= 4 or v_year >= 12 then
      update public.referrals set status = 'capped', reason = case when v_year >= 12 then 'year_cap' else 'month_cap' end where id = p_id;
      return 'capped';
    end if;
  end if;

  select plan_key, status, source, trial_ends_at, current_period_end, grace_ends_at into e from public.user_entitlements where user_id = r.inviter_id;
  v_store := found and e.plan_key = 'plus' and e.source in ('apple', 'google') and e.status <> 'trialing'
             and public.entitlement_grants(e.status, e.trial_ends_at, e.current_period_end, e.grace_ends_at, now());
  if v_store then
    perform public.spark_grant_reward(r.inviter_id, 500, 'referral:' || p_id, 'Invite reward', false);
  else
    insert into public.pro_promo_grants (user_id, days, source, referral_id) values (r.inviter_id, 7, 'referral', p_id);
    perform public.promo_apply_banked(r.inviter_id);
  end if;
  update public.referrals set status = 'rewarded', reason = null, rewarded_at = now(), reward_kind = case when v_store then 'sparks' else 'pro_week' end where id = p_id;
  update public.referral_codes set rewards_count = rewards_count + 1 where user_id = r.inviter_id;
  return 'rewarded';
end $$;

-- ============================================================ S8G-03: the trial is once per person, ever; a past store or paid member is refused
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
end $$;

-- ============================================================ S8G-04: the stay offer is spent only by a real purchase
alter table public.user_entitlements add column if not exists stay_offer_claimed_at timestamptz;

-- The app says it bought the discounted package. Spent now only when a store purchase landed in the last hour; otherwise the
-- webhook spends it when the purchase arrives within an hour of this claim (POST /api/billing/revenuecat).
create or replace function public.stay_offer_claim(p_user uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  update public.user_entitlements set stay_offer_claimed_at = now() where user_id = p_user and stay_offer_redeemed_at is null;
  update public.user_entitlements set stay_offer_redeemed_at = now()
  where user_id = p_user and stay_offer_redeemed_at is null
    and exists (select 1 from public.billing_events b where b.user_id = p_user and b.event_at > now() - interval '1 hour'
                and b.type in ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'));
  return jsonb_build_object('redeemed', found);
end $$;
revoke all on function public.stay_offer_claim(uuid) from public, anon, authenticated;
grant execute on function public.stay_offer_claim(uuid) to service_role;

-- ============================================================ S8G-02: every account has a loyalty row from sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.member_numbers (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.loyalty_accounts (user_id, tier_key) values (new.id, 'silver') on conflict (user_id) do nothing;
  return new;
end $$;
insert into public.loyalty_accounts (user_id, tier_key)
select u.id, 'silver' from auth.users u where not exists (select 1 from public.loyalty_accounts a where a.user_id = u.id)
on conflict (user_id) do nothing;

-- ============================================================ S8C-02: is this Auth session still live (same lookup as private.session_live_gate)
create or replace function public.session_is_live(p_session uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from auth.sessions where id = p_session)
$$;
revoke all on function public.session_is_live(uuid) from public, anon, authenticated;
grant execute on function public.session_is_live(uuid) to service_role;

-- ============================================================ S8G-08: founder bar bounded to recently active users; close_periods set-based
create index if not exists expenses_updated_brin on public.expenses using brin (updated_at);
create index if not exists income_events_updated_brin on public.income_events using brin (updated_at);
create index if not exists savings_transactions_updated_brin on public.savings_transactions using brin (updated_at);
create index if not exists sms_parse_log_confirmed_brin on public.sms_parse_log using brin (user_confirmed_at);

drop function if exists public.loyalty_founder_bar();
create function public.loyalty_founder_bar(p_users uuid[])
returns table(user_id uuid, qualified_at timestamptz, action_days integer, weeks integer)
language sql stable security definer set search_path to 'public' as $$
  with d as (select distinct a.user_id, a.day from public.loyalty_action_days a where a.user_id = any(p_users)),
  ranked as (select d.user_id, d.day, row_number() over (partition by d.user_id order by d.day) rn, date_trunc('week', d.day::timestamp) wk from d)
  select r.user_id,
         (min(r.day) filter (where r.rn = 7))::timestamptz,
         count(*)::integer,
         count(distinct r.wk)::integer
  from ranked r
  where not exists (select 1 from public.admin_staff s where s.user_id = r.user_id)
  group by r.user_id
  having count(*) >= 7 and count(distinct r.wk) >= 2
$$;
revoke all on function public.loyalty_founder_bar(uuid[]) from public, anon, authenticated;
grant execute on function public.loyalty_founder_bar(uuid[]) to service_role;

-- Only users who acted in the last 3 days can newly qualify (earlier qualifiers were proposed by earlier nightly runs).
-- ponytail: a 3-day look-back; if the nightly job is down longer, a qualifier is proposed on their next action instead.
create or replace function public.loyalty_grant_founders()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare p public.loyalty_program%rowtype; n integer; v_since timestamptz := now() - interval '3 days'; v_ids uuid[];
begin
  select * into p from public.loyalty_program;
  if not found or now() < p.founder_window_opens or now() > p.founder_window_closes then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('founders', 0));
  if (select count(*) from public.founders) >= p.founder_cap then return 0; end if;
  select coalesce(array_agg(x.user_id), '{}') into v_ids from (
    select e.user_id from public.expenses e where e.updated_at >= v_since
    union select i.user_id from public.income_events i where i.updated_at >= v_since
    union select s.user_id from public.savings_transactions s where s.updated_at >= v_since
    union select l.user_id from public.sms_parse_log l where l.user_confirmed_at >= v_since
  ) x
  where not exists (select 1 from public.founders f where f.user_id = x.user_id)
    and not exists (select 1 from public.founder_candidates fc where fc.user_id = x.user_id);
  if cardinality(v_ids) = 0 then return 0; end if;
  insert into public.founder_candidates (user_id, qualified_at)
  select b.user_id, b.qualified_at from public.loyalty_founder_bar(v_ids) b
  where exists (select 1 from public.loyalty_action_days a where a.user_id = b.user_id and a.day >= p.founder_window_opens::date)
  on conflict (user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Each user's current budget cycle (start) and the one before (prev), in their own timezone.
create or replace function private.loyalty_cycles(p_user uuid)
returns table(user_id uuid, tz text, today date, start date, prev date)
language sql stable security definer set search_path to 'public' as $$
  select x.user_id, x.tz, x.today, s.start, (s.start - interval '1 month')::date
  from (
    select us.user_id, us.timezone tz, public.loyalty_local_day(now(), us.timezone) today, least(coalesce(us.month_start_day, 1), 28) msd
    from public.user_settings us
    where (p_user is null or us.user_id = p_user)
      and exists (select 1 from public.budget_plan_activations b where b.user_id = us.user_id and b.deleted_at is null)
  ) x
  cross join lateral (select make_date(extract(year from x.today)::int, extract(month from x.today)::int, x.msd) d) m
  cross join lateral (select case when m.d > x.today then (m.d - interval '1 month')::date else m.d end as start) s
$$;
revoke all on function private.loyalty_cycles(uuid) from public, anon, authenticated;

drop function if exists public.loyalty_close_periods();
create function public.loyalty_close_periods(p_user uuid default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_paid integer; v_more integer;
begin
  with due as (
    select c.user_id, to_char(c.start, 'YYYY-MM') key from private.loyalty_cycles(p_user) c
    where c.today >= c.start + 7
      and exists (select 1 from public.budget_plan_activations b where b.user_id = c.user_id and b.deleted_at is null and b.effective_from <= c.start + 6)
      and exists (select 1 from public.budget_plan_activations b where b.user_id = c.user_id and b.deleted_at is null
                  and public.loyalty_local_day(greatest(b.created_at, coalesce(b.edited_at, b.created_at)), c.tz) between c.prev and c.start + 27)
  ), ins as (
    insert into public.loyalty_events (user_id, kind, period_key) select due.user_id, 'budget_set', due.key from due
    on conflict do nothing returning id, user_id
  )
  select coalesce(sum(public.loyalty_award(ins.user_id, 10, 'budget_set', ins.id::text)), 0) into v_paid from ins;

  with due as (
    select c.user_id, to_char(c.prev, 'YYYY-MM') key from private.loyalty_cycles(p_user) c
    where exists (select 1 from public.loyalty_events e where e.user_id = c.user_id and e.kind = 'budget_set' and e.period_key = to_char(c.prev, 'YYYY-MM'))
      and (select count(*) from public.loyalty_events e where e.user_id = c.user_id and e.kind in ('week_kept', 'week_frozen')
           and e.period_key >= to_char(c.prev, 'YYYY-MM-DD') and e.period_key < to_char(c.start, 'YYYY-MM-DD')) >= 3
      and not exists (select 1 from public.sms_parse_log l where l.user_id = c.user_id and l.awaiting_confirmation
                      and l.created_at >= c.prev - interval '1 day' and l.created_at < c.start + interval '1 day'
                      and public.loyalty_local_day(l.created_at, c.tz) >= c.prev and public.loyalty_local_day(l.created_at, c.tz) < c.start)
  ), ins as (
    insert into public.loyalty_events (user_id, kind, period_key) select due.user_id, 'month_tracked', due.key from due
    on conflict do nothing returning id, user_id
  )
  select coalesce(sum(public.loyalty_award(ins.user_id, 40, 'month_tracked', ins.id::text)), 0) into v_more from ins;
  return v_paid + v_more;
end $$;
revoke all on function public.loyalty_close_periods(uuid) from public, anon, authenticated;
grant execute on function public.loyalty_close_periods(uuid) to service_role;

-- ============================================================ S8C-01/03: no NaN or overflow on money; S8C-04: dates 2000..2099
alter table public.payment_methods drop constraint if exists payment_methods_opening_balance_sane;
alter table public.payment_methods add constraint payment_methods_opening_balance_sane
  check (opening_balance is null or (opening_balance > -1e16 and opening_balance < 1e16)) not valid;
alter table public.debts drop constraint if exists debts_money_sane;
alter table public.debts add constraint debts_money_sane check (
      (amount is null or (amount >= 0 and amount < 1e16))
  and (credit_limit is null or (credit_limit >= 0 and credit_limit < 1e16))
  and (installment_amount is null or (installment_amount >= 0 and installment_amount < 1e16))
  and (remaining_amount is null or (remaining_amount > -1e16 and remaining_amount < 1e16))
  and (starting_balance is null or (starting_balance > -1e16 and starting_balance < 1e16))
  and (interest_rate is null or (interest_rate >= 0 and interest_rate < 1e4))) not valid;
alter table public.debt_payments drop constraint if exists debt_payments_money_sane;
alter table public.debt_payments add constraint debt_payments_money_sane check (
      (amount_in_base is null or (amount_in_base > -1e16 and amount_in_base < 1e16))
  and (amount_in_debt_unit is null or (amount_in_debt_unit > -1e16 and amount_in_debt_unit < 1e16))
  and (original_amount is null or (original_amount > -1e16 and original_amount < 1e16))
  and (rate_at_entry is null or (rate_at_entry > 0 and rate_at_entry < 1e9))) not valid;
alter table public.expenses drop constraint if exists expenses_date_sane;
alter table public.expenses add constraint expenses_date_sane
  check (expense_date >= date '2000-01-01' and expense_date < date '2100-01-01') not valid;
alter table public.income_events drop constraint if exists income_events_dates_sane;
alter table public.income_events add constraint income_events_dates_sane
  check ((occurrence_date is null or (occurrence_date >= date '2000-01-01' and occurrence_date < date '2100-01-01'))
     and (received_date is null or (received_date >= date '2000-01-01' and received_date < date '2100-01-01'))) not valid;
alter table public.debt_payments drop constraint if exists debt_payments_date_sane;
alter table public.debt_payments add constraint debt_payments_date_sane
  check (payment_date is null or (payment_date >= date '2000-01-01' and payment_date < date '2100-01-01')) not valid;

alter table public.payment_methods validate constraint payment_methods_opening_balance_sane;
alter table public.debts validate constraint debts_money_sane;
alter table public.debt_payments validate constraint debt_payments_money_sane;
alter table public.expenses validate constraint expenses_date_sane;
alter table public.income_events validate constraint income_events_dates_sane;
alter table public.debt_payments validate constraint debt_payments_date_sane;

-- ============================================================ S8G-10: anon executes no public function (0315 rule)
-- EXECUTE came through PUBLIC, so revoke it there too and keep the signed-in callers explicit.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('grant execute on function %s to authenticated, service_role', f);
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;

do $$
begin
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
                       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')), 'anon still executes a public function';
  assert not has_function_privilege('authenticated', 'public.referral_redeem(uuid,text,text,text,text,text)', 'execute'), 'redeem must be service-only';
  assert has_function_privilege('authenticated', 'public.referral_my_summary()', 'execute'), 'summary lost its grant';
end $$;
