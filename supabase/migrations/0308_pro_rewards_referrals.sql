-- Pro, Rewards, Founders and Invites (docs/launch/PRO_REWARDS_SPEC.md section 3): invite codes, referrals, the 37-day trial for an
-- invited friend, activation (3 active days and 5 records in the first 14 days), banked Pro weeks for the inviter (500 reward Sparks
-- for a paying store subscriber), caps 4 a month / 12 a year, milestones 3/5/10, guards, clawback, the kill switch, member numbers.
-- Mirrored in src/lib/referrals/rules.ts (pinned by rules.test.ts).
--
-- AUDIT SELECT (live, 2026-11-17, before applying): select count(*) from auth.users;  -- 48. New tables only; no row is changed here.

insert into public.platform_settings (key, value) values ('referrals', '{"enabled": true}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------- member numbers
create sequence if not exists public.member_number_seq;
create table if not exists public.member_numbers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  number integer not null unique default nextval('public.member_number_seq'),
  created_at timestamptz not null default now()
);
alter sequence public.member_number_seq owned by public.member_numbers.number;
alter table public.member_numbers enable row level security;
revoke all on public.member_numbers from anon, authenticated;
grant select on public.member_numbers to authenticated;
grant all on public.member_numbers to service_role;
create policy member_numbers_own on public.member_numbers for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.member_numbers (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$function$;

-- ---------------------------------------------------------------- codes and referrals
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$'),
  created_at timestamptz not null default now(),
  -- counters, so the Invite page never re-counts referrals
  invited_count integer not null default 0,
  activated_count integer not null default 0,
  rewards_count integer not null default 0
);

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  inviter_id uuid references auth.users (id) on delete set null,
  invitee_id uuid unique references auth.users (id) on delete set null,
  code text not null,
  device_id text,
  invitee_created_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'activated', 'rewarded', 'capped', 'rejected', 'expired', 'revoked', 'clawed_back')),
  reason text,
  active_days smallint not null default 0,
  tx_count smallint not null default 0,
  trial_bonus_applied boolean not null default false,
  reward_kind text check (reward_kind in ('pro_week', 'sparks')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  rewarded_at timestamptz,
  ended_at timestamptz
);
create index if not exists referrals_inviter_idx on public.referrals (inviter_id, created_at desc) where inviter_id is not null;
create index if not exists referrals_pending_idx on public.referrals (id) where status = 'pending';
create index if not exists referrals_inviter_rewarded_idx on public.referrals (inviter_id, rewarded_at) where rewarded_at is not null;
create index if not exists referrals_device_idx on public.referrals (device_id) where device_id is not null;

-- Banked Pro time (invite rewards and staff promos): starts when the current trial or Pro ends.
create table if not exists public.pro_promo_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  days integer not null check (days > 0),
  source text not null check (source in ('referral', 'admin')),
  referral_id bigint references public.referrals (id) on delete set null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  revoked_at timestamptz
);
create index if not exists pro_promo_grants_banked_idx on public.pro_promo_grants (user_id) where started_at is null and revoked_at is null;
create index if not exists pro_promo_grants_user_idx on public.pro_promo_grants (user_id, created_at desc);
create index if not exists pro_promo_grants_referral_idx on public.pro_promo_grants (referral_id) where referral_id is not null;

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.pro_promo_grants enable row level security;
revoke all on public.referral_codes, public.referrals, public.pro_promo_grants from anon, authenticated;
grant select on public.referral_codes, public.pro_promo_grants to authenticated;
grant all on public.referral_codes, public.referrals, public.pro_promo_grants to service_role;
create policy referral_codes_own on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
create policy pro_promo_grants_own on public.pro_promo_grants for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.referrals_enabled()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'referrals'), false)
$$;

-- A short code: up to 6 letters of the display name (A to Z only; BUDDY when there are fewer than 2), a dash, 3 random characters
-- from an alphabet without look-alikes. Made once per user.
create or replace function public.referral_ensure_code(p_user uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_code text; v_prefix text; v_alpha text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; v_suffix text; i integer; j integer;
begin
  select code into v_code from public.referral_codes where user_id = p_user;
  if v_code is not null then return v_code; end if;
  select left(regexp_replace(upper(coalesce(nullif(split_part(btrim(coalesce(nullif(p.display_name, ''), p.name)), ' ', 1), ''), '')), '[^A-Z]', '', 'g'), 6)
    into v_prefix from public.profiles p where p.id = p_user;
  if coalesce(length(v_prefix), 0) < 2 then v_prefix := 'BUDDY'; end if;
  for i in 1..12 loop
    v_suffix := '';
    for j in 1..(case when i <= 8 then 3 else 5 end) loop
      v_suffix := v_suffix || substr(v_alpha, 1 + floor(random() * length(v_alpha))::integer, 1);
    end loop;
    insert into public.referral_codes (user_id, code) values (p_user, v_prefix || '-' || v_suffix) on conflict do nothing;
    select code into v_code from public.referral_codes where user_id = p_user;
    if v_code is not null then return v_code; end if;
  end loop;
  raise exception 'code_exhausted';
end;
$$;

-- ---------------------------------------------------------------- banked Pro weeks
-- Starts every banked grant of one user when no trial or Pro grants access now; extends a running promo at once.
create or replace function public.promo_apply_banked(p_user uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_days integer; e record; v_grants boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('billing:' || p_user::text, 0));
  select coalesce(sum(days), 0) into v_days from public.pro_promo_grants where user_id = p_user and started_at is null and revoked_at is null;
  if v_days = 0 then return 0; end if;
  select plan_key, status, source, trial_ends_at, current_period_end, grace_ends_at into e from public.user_entitlements where user_id = p_user;
  v_grants := found and e.plan_key <> 'free' and public.entitlement_grants(e.status, e.trial_ends_at, e.current_period_end, e.grace_ends_at, now());
  if v_grants and not (e.plan_key = 'plus' and e.source = 'promo' and e.status = 'active') then return 0; end if;
  if v_grants then
    update public.user_entitlements set current_period_end = current_period_end + make_interval(days => v_days), updated_at = now()
      where user_id = p_user;
  else
    insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, current_period_end, canceled_at, note)
    values (p_user, 'plus', 'active', 'promo', null, now() + make_interval(days => v_days), null, 'Banked Pro weeks')
    on conflict (user_id) do update set plan_key = 'plus', status = 'active', source = 'promo', trial_ends_at = null,
      current_period_end = now() + make_interval(days => v_days), canceled_at = null, grace_ends_at = null, will_renew = null, note = 'Banked Pro weeks', updated_at = now();
  end if;
  update public.pro_promo_grants set started_at = now() where user_id = p_user and started_at is null and revoked_at is null;
  return v_days;
end;
$$;

-- ---------------------------------------------------------------- the friend's side
-- Redeem at sign-up. Statuses: ok, disabled, invalid_code, self_invite, account_too_old, already_redeemed, device_used.
-- A friend who already has the 30-day trial gets 7 more days at once; one who has not gets 37 days when the trial is claimed.
create or replace function public.referral_redeem(p_code text, p_device_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid(); c record; v_created timestamptz; v_code text := upper(btrim(coalesce(p_code, ''))); v_id bigint; v_extended boolean := false;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if not public.referrals_enabled() then return jsonb_build_object('status', 'disabled'); end if;
  select user_id, created_at into c from public.referral_codes where code = v_code;
  if not found then return jsonb_build_object('status', 'invalid_code'); end if;
  if c.user_id = u then return jsonb_build_object('status', 'self_invite'); end if;
  select created_at into v_created from auth.users where id = u;
  if v_created < c.created_at or v_created < now() - interval '7 days' then return jsonb_build_object('status', 'account_too_old'); end if;
  if exists (select 1 from public.referrals r where r.invitee_id = u) then return jsonb_build_object('status', 'already_redeemed'); end if;
  if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = c.user_id and b.user_id = u)
     or (nullif(p_device_id, '') is not null and exists (select 1 from public.user_devices d where d.user_id = c.user_id and d.device_id = p_device_id)) then
    return jsonb_build_object('status', 'self_invite');
  end if;
  if nullif(p_device_id, '') is not null and exists (select 1 from public.referrals r where r.device_id = p_device_id and r.invitee_id is distinct from u) then
    insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at, status, reason, ended_at)
    values (c.user_id, u, v_code, p_device_id, v_created, 'rejected', 'device_used', now());
    return jsonb_build_object('status', 'device_used');
  end if;

  insert into public.referrals (inviter_id, invitee_id, code, device_id, invitee_created_at) values (c.user_id, u, v_code, nullif(p_device_id, ''), v_created)
  returning id into v_id;
  update public.referral_codes set invited_count = invited_count + 1 where user_id = c.user_id;
  update public.user_entitlements set trial_ends_at = trial_ends_at + interval '7 days', updated_at = now()
    where user_id = u and plan_key = 'plus_trial' and status = 'trialing' and trial_ends_at > now();
  v_extended := found;
  if v_extended then update public.referrals set trial_bonus_applied = true where id = v_id; end if;
  return jsonb_build_object('status', 'ok', 'trialExtended', v_extended);
end;
$$;

-- trial_claim (0298) plus 7 days for an invited friend whose bonus is not applied yet.
create or replace function public.trial_claim(p_user uuid, p_email_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_days integer; v_end timestamptz; v_cap integer; v_n integer; v_ent public.user_entitlements%rowtype; v_ref bigint;
begin
  if p_email_key is null or length(p_email_key) < 3 then return jsonb_build_object('status', 'invalid_email'); end if;
  if not public.billing_enabled() then return jsonb_build_object('status', 'billing_off'); end if;
  perform pg_advisory_xact_lock(hashtextextended('trial:' || p_user::text, 0));
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and v_ent.source <> 'default' and (
       (v_ent.status = 'active' and (v_ent.current_period_end is null or v_ent.current_period_end > now()))
    or (v_ent.status = 'trialing' and (v_ent.trial_ends_at is null or v_ent.trial_ends_at > now()))
    or v_ent.status in ('canceled', 'past_due', 'paused')
  ) then return jsonb_build_object('status', 'already_entitled'); end if;
  select coalesce((value ->> 'dailyCap')::integer, 200) into v_cap from public.platform_settings where key = 'trial_limits';
  select count(*) into v_n from public.trial_claims where claimed_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if v_n >= coalesce(v_cap, 200) then return jsonb_build_object('status', 'daily_cap'); end if;
  insert into public.trial_claims (email_key, user_id) values (p_email_key, p_user) on conflict (email_key) do nothing;
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
$$;

-- ---------------------------------------------------------------- activation and the inviter's reward
-- Pays one activated (or, with p_force, a capped, rejected, pending or expired) referral: guards, caps (4 per calendar month, 12 per
-- year, UTC), then 7 banked Pro days, or 500 reward Sparks for an inviter who pays through a store. Milestones on activated friends:
-- 3 = +50 points, 5 = +100 points, 10 = the Connector card finish. Returns the new status.
create or replace function public.referral_reward(p_id bigint, p_force boolean default false)
returns text language plpgsql security definer set search_path to 'public' as $$
declare r public.referrals%rowtype; v_month integer; v_year integer; v_act integer; e record; v_store boolean;
begin
  select * into r from public.referrals where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.inviter_id is null or r.invitee_id is null then return r.status; end if;
  if not (r.status = 'activated' or (p_force and r.status in ('capped', 'rejected', 'pending', 'expired'))) then return r.status; end if;
  perform pg_advisory_xact_lock(hashtextextended('referral:' || r.inviter_id::text, 0));

  -- First time this friend counts as activated: the counter and the milestones (capped friends count too).
  if r.status = 'activated' or (p_force and r.status in ('pending', 'expired')) then
    update public.referral_codes set activated_count = activated_count + 1 where user_id = r.inviter_id returning activated_count into v_act;
    if r.activated_at is null then update public.referrals set activated_at = now() where id = p_id; end if;
    if v_act = 3 then perform public.loyalty_award(r.inviter_id, 50, 'referral_milestone', '3'); end if;
    if v_act = 5 then perform public.loyalty_award(r.inviter_id, 100, 'referral_milestone', '5'); end if;
    if v_act = 10 then insert into public.loyalty_owned_items (user_id, kind, item_key, source) values (r.inviter_id, 'card_finish', 'connector', 'milestone') on conflict do nothing; end if;
  end if;

  if not p_force then
    if exists (select 1 from public.user_devices a join public.user_devices b on b.device_id = a.device_id where a.user_id = r.inviter_id and b.user_id = r.invitee_id) then
      update public.referrals set status = 'rejected', reason = 'self_device', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
    if exists (select 1 from public.user_devices d join public.referrals o on o.device_id = d.device_id
               where d.user_id = r.invitee_id and o.id <> r.id and o.status = 'rewarded') then
      update public.referrals set status = 'rejected', reason = 'device_used', ended_at = now() where id = p_id;
      return 'rejected';
    end if;
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
end;
$$;

-- Takes a paid reward back: unstarted banked days are revoked; started days come off a running promo; reward Sparks not yet spent
-- are removed. Status clawed_back (or p_status, e.g. revoked by staff).
create or replace function public.referral_clawback(p_id bigint, p_status text default 'clawed_back')
returns text language plpgsql security definer set search_path to 'public' as $$
declare r public.referrals%rowtype; g record;
begin
  select * into r from public.referrals where id = p_id for update;
  if not found then return 'not_found'; end if;
  if r.status = 'rewarded' and r.inviter_id is not null then
    for g in select id, days, started_at from public.pro_promo_grants where referral_id = p_id and revoked_at is null loop
      update public.pro_promo_grants set revoked_at = now() where id = g.id;
      if g.started_at is not null then
        update public.user_entitlements set current_period_end = greatest(now(), current_period_end - make_interval(days => g.days)), updated_at = now()
          where user_id = r.inviter_id and plan_key = 'plus' and source = 'promo' and current_period_end is not null;
      end if;
    end loop;
    update public.spark_allowances set granted = used, period_end = greatest(period_start, now())
      where user_id = r.inviter_id and kind = 'reward' and ref = 'referral:' || p_id;
    update public.referral_codes set rewards_count = greatest(0, rewards_count - 1) where user_id = r.inviter_id;
  end if;
  update public.referrals set status = p_status, ended_at = now() where id = p_id;
  return p_status;
end;
$$;

-- A friend's account deleted (the FK sets invitee_id to null): within 30 days of sign-up a paid reward is clawed back; a pending one ends.
create or replace function public.referrals_on_invitee_deleted()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.invitee_id is not null and new.invitee_id is null then
    if old.status = 'rewarded' and now() < old.invitee_created_at + interval '30 days' then
      perform public.referral_clawback(new.id, 'clawed_back');
    elsif old.status in ('pending', 'activated') then
      update public.referrals set status = 'revoked', reason = 'account_deleted', ended_at = now() where id = new.id;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists referrals_invitee_deleted on public.referrals;
create trigger referrals_invitee_deleted after update of invitee_id on public.referrals for each row execute function public.referrals_on_invitee_deleted();

-- Activation check, set-based over pending referrals (all of them, or one friend's). Counts, inside the friend's first 14 days,
-- distinct days (friend's timezone) with a record created and records created (expenses + income). Bounded: pending rows by id with
-- a limit; each friend's rows via the live (user_id) indexes. Then pays each newly activated one. Returns the number activated.
create or replace function public.referral_evaluate(p_invitee uuid default null, p_limit integer default 500)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_ids bigint[]; v_id bigint;
begin
  if not public.referrals_enabled() then return 0; end if;
  with c as (
    select r.id, r.invitee_id, r.invitee_created_at, r.active_days, r.tx_count, coalesce(nullif(us.timezone, ''), 'UTC') tz
    from public.referrals r left join public.user_settings us on us.user_id = r.invitee_id
    where r.status = 'pending' and r.invitee_id is not null and (p_invitee is null or r.invitee_id = p_invitee)
    order by r.id limit p_limit
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
    from n where r.id = n.id and (n.next_status <> 'pending' or n.days <> n.active_days or n.tx <> n.tx_count)
    returning r.id, r.status
  )
  select coalesce(array_agg(id), '{}') into v_ids from u where status = 'activated';
  foreach v_id in array v_ids loop
    perform public.referral_reward(v_id, false);
  end loop;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- The Invite page in one call: the code and link, counters, caps used, rewards earned, milestones and up to 50 friends with progress.
-- A friend shows by the first word of their own display name only.
create or replace function public.referral_my_summary()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare u uuid := auth.uid(); v_code text; rc public.referral_codes%rowtype; v_month integer; v_year integer;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  v_code := public.referral_ensure_code(u);
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
end;
$$;

revoke all on function public.referrals_enabled(), public.referral_ensure_code(uuid), public.promo_apply_banked(uuid), public.referral_reward(bigint, boolean),
  public.referral_clawback(bigint, text), public.referrals_on_invitee_deleted(), public.referral_evaluate(uuid, integer) from public, anon, authenticated;
grant execute on function public.referrals_enabled(), public.referral_ensure_code(uuid), public.promo_apply_banked(uuid), public.referral_reward(bigint, boolean),
  public.referral_clawback(bigint, text), public.referral_evaluate(uuid, integer) to service_role;
revoke all on function public.referral_redeem(text, text), public.referral_my_summary() from public, anon;
grant execute on function public.referral_redeem(text, text), public.referral_my_summary() to authenticated, service_role;
