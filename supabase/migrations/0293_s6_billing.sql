-- S6 phase 4 (S5c section 14, items 9, 10, 13, 14): what the RevenueCat webhook writes, and how status grants access.
-- Nothing here is reachable until the webhook route is called with the owner's secrets; no entitlement row changes today.

alter table public.plans add column if not exists store_products jsonb not null default '{}'::jsonb;
update public.plans set store_products = '{"app_store": {"monthly": "plus_monthly", "annual": "plus_annual"}, "play_store": {"monthly": "plus_monthly", "annual": "plus_annual"}}'::jsonb where key = 'plus';

alter table public.user_entitlements
  add column if not exists product_id text,
  add column if not exists store text check (store in ('app_store', 'play_store')),
  add column if not exists store_original_txn text,
  add column if not exists will_renew boolean,
  add column if not exists last_event_at timestamptz,
  add column if not exists grace_ends_at timestamptz;
create unique index if not exists user_entitlements_store_txn_uidx on public.user_entitlements (store_original_txn) where store_original_txn is not null;

-- The idempotency table (S4 section 5): insert first, process only if the insert won. Event id and type only, never the payload.
create table public.billing_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  type text not null,
  user_id uuid,
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  outcome text not null default 'received' check (outcome in ('received', 'applied', 'stale', 'ignored')),
  unique (provider, event_id)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;
grant all on public.billing_events to service_role;

-- Item 14 and S4 section 5: does this status still grant the plan? One rule, mirrored in src/lib/entitlements/resolve.ts
-- and pinned by one shared table of cases. A canceled plan keeps access to the end of the paid period. A past_due plan keeps
-- it until the grace expiry the store reported, or three days after the period end when none was reported.
create or replace function public.entitlement_grants(p_status text, p_trial_ends timestamptz, p_period_end timestamptz, p_grace_ends timestamptz, p_now timestamptz)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select case p_status
    when 'trialing' then p_trial_ends is null or p_trial_ends > p_now
    when 'active' then p_period_end is null or p_period_end > p_now
    when 'canceled' then p_period_end is not null and p_period_end > p_now
    when 'past_due' then coalesce(p_grace_ends, p_period_end + interval '3 days') is null or coalesce(p_grace_ends, p_period_end + interval '3 days') > p_now
    else false
  end
$$;

create or replace function public.ai_effective_limits(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  d jsonb := public.ai_default_limits();
  merged jsonb := public.ai_default_limits();
  v_ent public.user_entitlements%rowtype;
  v_limits jsonb;
  v_over jsonb;
  v_feat jsonb;
  v_disabled jsonb := '[]'::jsonb;
  layer jsonb;
  k text;
  v jsonb;
  mapped text;
begin
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if v_ent.user_id is not null then
    if public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, now()) then
      select p.limits into v_limits from public.plans p where p.key = v_ent.plan_key;
    end if;
    v_over := v_ent.limit_overrides;
    v_feat := v_ent.feature_overrides;
  end if;
  if v_limits is null then
    select p.limits into v_limits from public.plans p where p.is_default order by p.created_at limit 1;
  end if;

  foreach layer in array array[v_limits, v_over] loop
    if layer is not null and jsonb_typeof(layer) = 'object' then
      for k, v in select * from jsonb_each(layer) loop
        if d ? k and (jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 0)) then
          merged := merged || jsonb_build_object(k, v);
        end if;
      end loop;
    end if;
  end loop;

  if v_feat is not null and jsonb_typeof(v_feat) = 'object' then
    for k, v in select * from jsonb_each(v_feat) loop
      if v = 'false'::jsonb then
        mapped := case k
          when 'ai_assistant' then 'chat'
          when 'receipt_scanning' then 'receipt'
          when 'sms_tracking' then 'sms'
          when 'ai_voice' then 'voice'
          when 'ai_budget' then 'budget'
          else case when k like 'ai\_tool\_%' then 'tool:' || substr(k, 9) else null end
        end;
        if mapped is not null then v_disabled := v_disabled || to_jsonb(mapped); end if;
        if k = 'ai_assistant' then v_disabled := v_disabled || to_jsonb('proxy'::text); end if;
      end if;
    end loop;
  end if;

  return merged || jsonb_build_object('disabled', v_disabled);
end;
$function$;

-- Annual subscribers get their Sparks monthly from the purchase date: each month's period row is made on first use.
create or replace function public.spark_ensure_allowance(p_user uuid, p_t timestamptz, p_granted integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ent public.user_entitlements%rowtype;
  v_last public.spark_allowances%rowtype;
  v_start timestamptz;
  i integer := 0;
begin
  if exists (
    select 1 from public.spark_allowances
    where user_id = p_user and kind in ('plan', 'trial') and period_start <= p_t and period_end > p_t
  ) then return; end if;

  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and v_ent.store is not null and v_ent.product_id like 'plus_annual%'
     and public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, p_t) then
    select * into v_last from public.spark_allowances
      where user_id = p_user and kind = 'plan' and ref = 'store:annual' and original_period_end is null
      order by period_start desc limit 1;
    if found then
      v_start := v_last.period_end;
      while v_start <= p_t and i < 12 loop
        if v_ent.current_period_end is not null and v_start >= v_ent.current_period_end then exit; end if;
        insert into public.spark_allowances (user_id, kind, granted, period_start, period_end, ref)
        values (p_user, 'plan', v_last.granted, v_start, least(v_start + interval '1 month', coalesce(v_ent.current_period_end, v_start + interval '1 month')), 'store:annual')
        on conflict (user_id, kind, period_start) do nothing;
        v_start := v_start + interval '1 month';
        i := i + 1;
      end loop;
      if exists (select 1 from public.spark_allowances where user_id = p_user and kind = 'plan' and period_start <= p_t and period_end > p_t) then return; end if;
    end if;
  end if;

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

-- Apply one webhook event atomically. The TypeScript side decides what an event means (src/lib/billing/revenuecat.ts) and
-- passes p_effect; this function only records the event once, refuses an older one, and writes what it is told.
-- p_effect: { entitlement: {plan_key,status,source,trial_ends_at,current_period_end,canceled_at,will_renew,product_id,store,
--             store_original_txn,grace_ends_at} | null, sparks: {action: open|end|restore, ...} | null, endTrial: bool,
--             transfer: {from: uuid[]} | null }
-- Returns applied | duplicate | stale.
create or replace function public.billing_apply(p_user uuid, p_event_id text, p_type text, p_event_ms bigint, p_effect jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_at timestamptz := to_timestamp(p_event_ms / 1000.0);
  v_n integer;
  v_last timestamptz;
  e jsonb := p_effect -> 'entitlement';
  s jsonb := p_effect -> 'sparks';
  v_from uuid;
begin
  insert into public.billing_events (provider, event_id, type, user_id, event_at)
  values ('revenuecat', p_event_id, p_type, p_user, v_at)
  on conflict (provider, event_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'duplicate'; end if;

  perform pg_advisory_xact_lock(hashtextextended('billing:' || p_user::text, 0));
  select last_event_at into v_last from public.user_entitlements where user_id = p_user;
  if v_last is not null and v_at < v_last then
    update public.billing_events set outcome = 'stale' where provider = 'revenuecat' and event_id = p_event_id;
    return 'stale';
  end if;

  if (p_effect -> 'transfer') is not null then
    for v_from in select (jsonb_array_elements_text(p_effect -> 'transfer' -> 'from'))::uuid loop
      if v_from <> p_user then
        update public.user_entitlements set status = 'expired', will_renew = false, store_original_txn = null, last_event_at = v_at, updated_at = now() where user_id = v_from;
      end if;
    end loop;
  end if;

  if e is not null then
    insert into public.user_entitlements as ue (user_id, plan_key, status, source, trial_ends_at, current_period_end, canceled_at, will_renew, product_id, store, store_original_txn, grace_ends_at, last_event_at)
    values (p_user, e ->> 'plan_key', e ->> 'status', e ->> 'source', (e ->> 'trial_ends_at')::timestamptz, (e ->> 'current_period_end')::timestamptz,
            (e ->> 'canceled_at')::timestamptz, (e ->> 'will_renew')::boolean, e ->> 'product_id', e ->> 'store', e ->> 'store_original_txn', (e ->> 'grace_ends_at')::timestamptz, v_at)
    on conflict (user_id) do update set
      plan_key = excluded.plan_key, status = excluded.status, source = excluded.source, trial_ends_at = excluded.trial_ends_at,
      current_period_end = excluded.current_period_end, canceled_at = excluded.canceled_at, will_renew = excluded.will_renew,
      product_id = excluded.product_id, store = excluded.store, store_original_txn = excluded.store_original_txn,
      grace_ends_at = excluded.grace_ends_at, last_event_at = v_at, updated_at = now();
  end if;

  if coalesce((p_effect ->> 'endTrial')::boolean, false) then
    update public.spark_allowances set period_end = greatest(period_start, now())
      where user_id = p_user and kind = 'trial' and period_start <= now() and period_end > now();
  end if;

  if s is not null then
    case s ->> 'action'
      when 'open' then
        perform public.spark_open_plan_period(p_user, (s ->> 'start')::timestamptz, (s ->> 'end')::timestamptz,
          coalesce((s ->> 'granted')::integer, (select (limits ->> 'sparks_per_month')::integer from public.plans where key = 'plus')), s ->> 'ref');
      when 'end' then perform public.spark_end_plan_period(p_user, v_at);
      when 'restore' then perform public.spark_restore_plan_period(p_user);
      else null;
    end case;
  end if;

  update public.billing_events set outcome = 'applied' where provider = 'revenuecat' and event_id = p_event_id;
  return 'applied';
end;
$$;

-- Events the route reads but does nothing with (a type with no effect, a product that is not ours): recorded once, for the audit trail.
create or replace function public.billing_note(p_user uuid, p_event_id text, p_type text, p_event_ms bigint)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.billing_events (provider, event_id, type, user_id, event_at, outcome)
  values ('revenuecat', p_event_id, p_type, p_user, to_timestamp(p_event_ms / 1000.0), 'ignored')
  on conflict (provider, event_id) do nothing
$$;

revoke all on function public.billing_apply(uuid, text, text, bigint, jsonb), public.billing_note(uuid, text, text, bigint),
  public.entitlement_grants(text, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.billing_apply(uuid, text, text, bigint, jsonb), public.billing_note(uuid, text, text, bigint),
  public.entitlement_grants(text, timestamptz, timestamptz, timestamptz, timestamptz) to service_role;
