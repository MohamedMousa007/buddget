-- S6 phase 2 (S5c section 14, items 8 to 11): the Sparks ledger.
-- Ledger 1 (spark_allowances: plan, trial, bonus; expires), ledger 2 (spark_purchases: created empty, only the billing
-- webhook may ever write it), and the append-only spend log. Charging happens when a call settles `ok`, or `aborted`
-- with output tokens; an error, a release or an abort with no output is free. A denial for lack of Sparks is only
-- enforced while billing_enabled() is true; the spend is recorded either way, so Sparks used can be measured.

create table public.spark_prices (
  feature text primary key,
  sparks integer not null check (sparks >= 0),
  updated_at timestamptz not null default now()
);
insert into public.spark_prices (feature, sparks) values
  ('chat', 1), ('chat_hop', 0), ('voice', 1), ('proxy', 1), ('receipt', 2), ('budget', 2),
  ('goals', 1), ('goals_grounded', 10), ('sms', 0);

create table public.spark_allowances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('plan', 'trial', 'bonus')),
  granted integer not null check (granted >= 0),
  used integer not null default 0,
  period_start timestamptz not null,
  period_end timestamptz not null,
  -- 'monthly' = the free (or promo) calendar-month row made on first use; 'store:monthly' / 'store:annual' = opened by the webhook
  ref text,
  -- set while a refund holds the period closed, so REFUND_REVERSED can reopen it
  original_period_end timestamptz,
  created_at timestamptz not null default now(),
  check (used >= 0 and used <= granted),
  check (period_end >= period_start),
  unique (user_id, kind, period_start)
);
create index spark_allowances_open_idx on public.spark_allowances (user_id, period_end);

create table public.spark_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('app_store', 'play_store')),
  store_txn text not null unique,
  product_id text not null,
  sparks integer not null check (sparks > 0),
  remaining integer not null check (remaining >= 0 and remaining <= sparks),
  price_micros bigint,
  currency text,
  purchased_at timestamptz not null default now(),
  refunded_at timestamptz
);
create index spark_purchases_user_idx on public.spark_purchases (user_id) where refunded_at is null;

create table public.spark_spend (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  reservation_id uuid,
  feature text not null,
  sparks integer not null check (sparks > 0),
  allowance_id uuid references public.spark_allowances (id) on delete cascade,
  purchase_id uuid references public.spark_purchases (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- exactly one ledger is charged per row
  constraint spark_spend_one_ledger check ((allowance_id is null) <> (purchase_id is null))
);
create index spark_spend_user_idx on public.spark_spend (user_id, created_at);

alter table public.spark_prices enable row level security;
alter table public.spark_allowances enable row level security;
alter table public.spark_purchases enable row level security;
alter table public.spark_spend enable row level security;
create policy spark_prices_read on public.spark_prices for select to authenticated using (true);
create policy spark_allowances_own on public.spark_allowances for select to authenticated using (user_id = (select auth.uid()));
create policy spark_purchases_own on public.spark_purchases for select to authenticated using (user_id = (select auth.uid()));
create policy spark_spend_own on public.spark_spend for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend from anon, authenticated;
grant select on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend to authenticated;
grant all on public.spark_prices, public.spark_allowances, public.spark_purchases, public.spark_spend to service_role;

alter table public.ai_reservations add column if not exists sparks integer not null default 0;

-- Make the current month's allowance on first use, unless a plan or trial row is already open.
create or replace function public.spark_ensure_allowance(p_user uuid, p_t timestamptz, p_granted integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.spark_allowances
    where user_id = p_user and kind in ('plan', 'trial') and period_start <= p_t and period_end > p_t
  ) then return; end if;
  insert into public.spark_allowances (user_id, kind, granted, period_start, period_end, ref)
  values (
    p_user, 'plan', greatest(p_granted, 0),
    date_trunc('month', p_t at time zone 'UTC') at time zone 'UTC',
    (date_trunc('month', p_t at time zone 'UTC') + interval '1 month') at time zone 'UTC',
    'monthly'
  )
  on conflict (user_id, kind, period_start) do nothing;
end;
$$;

-- Sparks the user can spend now: open allowances plus unrefunded purchases, minus what live reservations hold.
create or replace function public.spark_available(p_user uuid, p_t timestamptz)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select (
    coalesce((select sum(granted - used) from public.spark_allowances where user_id = p_user and period_start <= p_t and period_end > p_t), 0)
    + coalesce((select sum(remaining) from public.spark_purchases where user_id = p_user and refunded_at is null), 0)
    - coalesce((select sum(sparks) from public.ai_reservations where user_id = p_user and not settled and expires_at > p_t), 0)
  )::integer
$$;

-- Charge a settled call: allowances first (soonest expiry first), then purchased packs oldest first. Never overdraws:
-- a balance that vanished between the reserve and the settle leaves the remainder uncharged.
create or replace function public.spark_charge(p_user uuid, p_sparks integer, p_reservation uuid, p_feature text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  need integer := p_sparks;
  take integer;
  a record;
begin
  for a in
    select id, granted - used as left_over from public.spark_allowances
    where user_id = p_user and period_start <= now() and period_end > now() and granted > used
    order by period_end, created_at
    for update
  loop
    exit when need <= 0;
    take := least(need, a.left_over);
    update public.spark_allowances set used = used + take where id = a.id;
    insert into public.spark_spend (user_id, reservation_id, feature, sparks, allowance_id) values (p_user, p_reservation, p_feature, take, a.id);
    need := need - take;
  end loop;
  for a in
    select id, remaining as left_over from public.spark_purchases
    where user_id = p_user and refunded_at is null and remaining > 0
    order by purchased_at
    for update
  loop
    exit when need <= 0;
    take := least(need, a.left_over);
    update public.spark_purchases set remaining = remaining - take where id = a.id;
    insert into public.spark_spend (user_id, reservation_id, feature, sparks, purchase_id) values (p_user, p_reservation, p_feature, take, a.id);
    need := need - take;
  end loop;
  return p_sparks - need;
end;
$$;

-- Allowance periods (item 9 and 10). Only the billing webhook calls these.
-- Open a `plan` period: idempotent, one row per user per period_start. The free calendar-month row is closed first so a
-- new subscriber does not hold both.
create or replace function public.spark_open_plan_period(p_user uuid, p_start timestamptz, p_end timestamptz, p_granted integer, p_ref text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.spark_allowances
    set period_end = greatest(period_start, now())
    where user_id = p_user and kind = 'plan' and ref = 'monthly' and period_start <= now() and period_end > now();
  insert into public.spark_allowances (user_id, kind, granted, period_start, period_end, ref)
  values (p_user, 'plan', greatest(p_granted, 0), p_start, p_end, p_ref)
  on conflict (user_id, kind, period_start) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Expiry or a refund: end the open store `plan` period now, remembering its real end.
create or replace function public.spark_end_plan_period(p_user uuid, p_at timestamptz)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.spark_allowances
    set original_period_end = period_end, period_end = greatest(period_start, p_at)
    where user_id = p_user and kind = 'plan' and ref like 'store:%' and original_period_end is null
      and period_start <= p_at and period_end > p_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- A refund reversed: reopen the most recent period a refund closed, if its real end has not passed.
create or replace function public.spark_restore_plan_period(p_user uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  update public.spark_allowances
    set period_end = original_period_end, original_period_end = null
    where id = (
      select id from public.spark_allowances
      where user_id = p_user and kind = 'plan' and ref like 'store:%' and original_period_end is not null
      order by period_start desc limit 1
    ) and original_period_end > now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.spark_ensure_allowance(uuid, timestamptz, integer), public.spark_available(uuid, timestamptz),
  public.spark_charge(uuid, integer, uuid, text), public.spark_open_plan_period(uuid, timestamptz, timestamptz, integer, text),
  public.spark_end_plan_period(uuid, timestamptz), public.spark_restore_plan_period(uuid) from public, anon, authenticated;
grant execute on function public.spark_ensure_allowance(uuid, timestamptz, integer), public.spark_available(uuid, timestamptz),
  public.spark_charge(uuid, integer, uuid, text), public.spark_open_plan_period(uuid, timestamptz, timestamptz, integer, text),
  public.spark_end_plan_period(uuid, timestamptz), public.spark_restore_plan_period(uuid) to service_role;

-- The reserve and settle functions keep their names and callers. The phase 1 bodies move to *_core (only these two
-- wrappers may call them) and the wrappers add the Sparks step around them, under the same per-user advisory lock.
alter function public.ai_quota_reserve_v2(uuid, uuid, text, numeric) rename to ai_quota_reserve_v2_core;
alter function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) rename to ai_quota_settle_core;
revoke execute on function public.ai_quota_reserve_v2_core(uuid, uuid, text, numeric) from service_role;
revoke execute on function public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) from service_role;

create function public.ai_quota_reserve_v2(p_user uuid, p_chat uuid, p_feature text, p_est numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  L jsonb;
  t timestamptz := now();
  v_price integer;
  r jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  L := public.ai_effective_limits(p_user);
  -- A null `sparks_per_month` (an override) means unlimited: nothing is priced or charged.
  v_price := case when (L ->> 'sparks_per_month') is null then 0
    else coalesce((select sparks from public.spark_prices where feature = p_feature), 0) end;
  if v_price > 0 then
    perform public.spark_ensure_allowance(p_user, t, (L ->> 'sparks_per_month')::integer);
    if public.billing_enabled() and public.spark_available(p_user, t) < v_price then
      return jsonb_build_object('allowed', false, 'layer', 'sparks',
        'reset_at', (select max(period_end) from public.spark_allowances where user_id = p_user and period_start <= t and period_end > t));
    end if;
  end if;
  r := public.ai_quota_reserve_v2_core(p_user, p_chat, p_feature, p_est);
  if (r ->> 'allowed')::boolean and v_price > 0 then
    update public.ai_reservations set sparks = v_price where id = (r ->> 'reservation_id')::uuid;
  end if;
  return r;
end;
$$;
revoke all on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric) to service_role;

create function public.ai_quota_settle(p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare r public.ai_reservations%rowtype;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return; end if;
  perform public.ai_quota_settle_core(p_reservation, p_user, p_units, p_in, p_cached, p_out, p_model, p_tier, p_latency, p_status);
  if r.sparks > 0 and (p_status = 'ok' or (p_status = 'aborted' and coalesce(p_out, 0) > 0)) then
    perform public.spark_charge(p_user, r.sparks, p_reservation, r.feature);
  end if;
end;
$$;
revoke all on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) to service_role;
