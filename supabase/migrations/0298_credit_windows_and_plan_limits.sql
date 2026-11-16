-- S6 monetization v9, phase 1: AI usage charged by real cost in two windows, Sparks as add-on usage, plan limits, balance views,
-- the Advisor gate, pack purchases and the supporting tables. One batched migration (the live database is a small Nano instance).
-- Everything that limits a user is inert while billing_enabled() is false, so testers lose nothing before selling is switched on.
-- 1 credit = 1 Spark = $0.001 of model cost = 1000 cost_usd_micro.

-- ---------------------------------------------------------------- columns and tables
alter table public.ai_reservations
  add column if not exists use_sparks boolean not null default false,
  add column if not exists advisor_free boolean not null default false;
alter table public.ai_usage_events add column if not exists credits_exempt boolean not null default false;
alter table public.billing_events
  add column if not exists store text,
  add column if not exists product_id text,
  add column if not exists price_micros bigint,
  add column if not exists currency text;

create table if not exists public.ai_credit_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_start timestamptz not null
);
create table if not exists public.ai_credit_resets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('session', 'week')),
  granted_by uuid,
  reason text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists ai_credit_resets_user_idx on public.ai_credit_resets (user_id, scope, created_at desc);
create table if not exists public.advisor_free_uses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now()
);
create index if not exists advisor_free_uses_user_idx on public.advisor_free_uses (user_id, used_at);
-- payment_method_id is deliberately not a foreign key: removing and re-adding an account must not reset the month's count.
create table if not exists public.balance_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payment_method_id uuid not null,
  viewed_at timestamptz not null default now()
);
create index if not exists balance_views_user_idx on public.balance_views (user_id, viewed_at);
create table if not exists public.coming_soon_interest (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('partner_sharing', 'advanced_insights')),
  created_at timestamptz not null default now(),
  primary key (user_id, feature)
);
-- One store product grants the same Sparks in every country; the pack is defined by its amount. The IDs are owner-set settings.
create table if not exists public.spark_products (
  product_id text primary key,
  sparks integer not null check (sparks > 0),
  countries text[],
  active boolean not null default true
);
insert into public.spark_products (product_id, sparks, countries) values
  ('sparks_70', 70, array['EG']), ('sparks_150', 150, array['EG']), ('sparks_400', 400, null), ('sparks_900', 900, null), ('sparks_2500', 2500, null)
on conflict (product_id) do nothing;

alter table public.ai_credit_sessions enable row level security;
alter table public.ai_credit_resets enable row level security;
alter table public.advisor_free_uses enable row level security;
alter table public.balance_views enable row level security;
alter table public.coming_soon_interest enable row level security;
alter table public.spark_products enable row level security;
revoke all on public.ai_credit_sessions, public.ai_credit_resets, public.advisor_free_uses, public.balance_views, public.spark_products from anon, authenticated;
revoke all on public.coming_soon_interest from anon, authenticated;
grant select on public.coming_soon_interest to authenticated;
create policy coming_soon_interest_own on public.coming_soon_interest for select to authenticated using (user_id = (select auth.uid()));
grant all on public.ai_credit_sessions, public.ai_credit_resets, public.advisor_free_uses, public.balance_views, public.coming_soon_interest, public.spark_products to service_role;

insert into public.platform_settings (key, value) values
  ('sparks_bonus', '{"proPercent": 25}'::jsonb),
  ('ai_pricing', '{"groundedSearchUsdMicro": 14000}'::jsonb)
on conflict (key) do nothing;
update public.ai_price_book set source_note = 'Seeded from the public list price ($0.111 per hour). Audio seconds are metered from migration 0298 and priced from audio_usd_per_min.'
  where model = 'whisper-large-v3' and effective_to is null;

-- ---------------------------------------------------------------- limits and plans
create or replace function public.ai_default_limits()
returns jsonb language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object(
    'ai_chat_units_soft', 30000, 'ai_chat_units_hard', 60000, 'ai_chat_turns', 40, 'ai_chats_per_hour', 30, 'ai_chats_per_day', 100,
    'ai_units_5h', 600000, 'ai_units_24h', 1500000, 'ai_units_7d', 6000000, 'ai_req_per_min', 30, 'ai_idle_minutes', 30,
    'ai_chat_per_day', null, 'receipt_scans_per_month', null, 'voice_entries_per_day', null, 'grounded_per_day', 3,
    'sparks_per_month', 0, 'sms_ai_calls_per_day', 30, 'sms_ai_calls_per_month', 150, 'sms_accounts_max', null, 'budget_plans_max', null, 'seats', 1,
    'ai_credits_session', 6, 'ai_credits_week', 15, 'balance_views_per_month', 10, 'advisor_free_per_month', 1
  )
$$;

update public.plans set limits = limits || '{"ai_credits_session": 6, "ai_credits_week": 15, "balance_views_per_month": 10, "advisor_free_per_month": 1, "sms_accounts_max": null, "sparks_per_month": 0}'::jsonb,
  description = 'Everyone starts here. SMS tracking on every account, limited AI, two saved plans.'
  where key = 'free';
update public.plans set limits = limits || '{"ai_credits_session": 50, "ai_credits_week": 150, "balance_views_per_month": null, "advisor_free_per_month": null, "sms_accounts_max": null, "budget_plans_max": null, "sparks_per_month": 0}'::jsonb,
  features = array['advanced_reports', 'budget_compare', 'buddgy_advisor'],
  description = 'About 10x the AI, the Advisor, unlimited plans and balance views, 25% more Sparks per pack.'
  where key = 'plus';
update public.plans set limits = limits || '{"ai_credits_session": 50, "ai_credits_week": 150, "balance_views_per_month": null, "advisor_free_per_month": null, "sms_accounts_max": null, "budget_plans_max": null, "sparks_per_month": 0}'::jsonb,
  features = array['advanced_reports', 'budget_compare', 'buddgy_advisor'], trial_days = 30,
  description = 'The 30-day trial of Pro, at Pro limits. Never listed on the paywall; no store products.'
  where key = 'plus_trial';

-- ---------------------------------------------------------------- cost
create or replace function public.ai_cost_usd_micro(p_model text, p_in integer, p_cached integer, p_out integer, p_audio_seconds integer, p_extra_micro bigint)
returns bigint language sql stable set search_path to 'public' as $$
  select coalesce(public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out), 0)
    + coalesce((select round(greatest(p_audio_seconds, 0) / 60.0 * b.audio_usd_per_min * 1000000)::bigint from public.ai_price_book b where b.model = p_model and b.effective_to is null and b.audio_usd_per_min is not null), 0)
    + greatest(coalesce(p_extra_micro, 0), 0)
$$;

-- ---------------------------------------------------------------- credit windows
-- Session: 5 hours from the first AI request after the previous session ended. Week: from the user's week-start day, in their timezone.
create or replace function public.ai_credit_windows(p_user uuid, p_t timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  tz text; wsd smallint; ws date;
  wk_start timestamptz; wk_end timestamptz; s_start timestamptz; s_cut timestamptz; w_cut timestamptz;
  s_used numeric := 0; w_used numeric;
begin
  select timezone, week_start_day into tz, wsd from public.user_settings where user_id = p_user;
  tz := coalesce(nullif(tz, ''), 'UTC');
  begin perform now() at time zone tz; exception when others then tz := 'UTC'; end;
  ws := public.loyalty_week_start(public.loyalty_local_day(p_t, tz), wsd);
  wk_start := ws::timestamp at time zone tz;
  wk_end := (ws + 7)::timestamp at time zone tz;
  select session_start into s_start from public.ai_credit_sessions where user_id = p_user;
  if s_start is not null and s_start + interval '5 hours' <= p_t then s_start := null; end if;
  w_cut := greatest(wk_start, coalesce((select max(created_at) from public.ai_credit_resets where user_id = p_user and scope = 'week'), '-infinity'));
  select coalesce(sum(cost_usd_micro), 0) / 1000.0 into w_used from public.ai_usage_events
    where user_id = p_user and feature <> 'sms' and not credits_exempt and created_at >= w_cut;
  if s_start is not null then
    s_cut := greatest(s_start, coalesce((select max(created_at) from public.ai_credit_resets where user_id = p_user and scope = 'session'), '-infinity'));
    select coalesce(sum(cost_usd_micro), 0) / 1000.0 into s_used from public.ai_usage_events
      where user_id = p_user and feature <> 'sms' and not credits_exempt and created_at >= s_cut;
  end if;
  return jsonb_build_object('session_used', s_used, 'session_start', s_start, 'session_reset', s_start + interval '5 hours',
    'week_used', w_used, 'week_start', wk_start, 'week_reset', wk_end, 'timezone', tz);
end;
$$;

-- ---------------------------------------------------------------- reserve and settle
drop function if exists public.ai_quota_reserve_v2(uuid, uuid, text, numeric);
create or replace function public.ai_quota_reserve_v2(p_user uuid, p_chat uuid, p_feature text, p_est numeric, p_advisor_free boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  L jsonb; w jsonb; r jsonb; t timestamptz := now();
  v_hop boolean := p_feature = 'chat_hop';
  v_credit boolean;
  s_lim numeric; w_lim numeric; s_over boolean := false; w_over boolean := false;
  v_use_sparks boolean := false;
  v_reset timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  L := public.ai_effective_limits(p_user);
  v_credit := p_feature <> 'sms' and not coalesce(p_advisor_free, false) and public.billing_enabled();
  if v_credit then
    w := public.ai_credit_windows(p_user, t);
    s_lim := (L ->> 'ai_credits_session')::numeric;
    w_lim := (L ->> 'ai_credits_week')::numeric;
    s_over := s_lim is not null and (w ->> 'session_used')::numeric >= s_lim;
    w_over := w_lim is not null and (w ->> 'week_used')::numeric >= w_lim;
    if s_over or w_over then
      if public.spark_available(p_user, t) >= 1 then
        v_use_sparks := true;
      elsif not v_hop then
        v_reset := case when s_over and w_over then greatest((w ->> 'session_reset')::timestamptz, (w ->> 'week_reset')::timestamptz)
                        when w_over then (w ->> 'week_reset')::timestamptz else (w ->> 'session_reset')::timestamptz end;
        return jsonb_build_object('allowed', false, 'layer', case when w_over then 'week' else 'session' end, 'reset_at', v_reset);
      end if;
      -- A hop belongs to a turn already admitted: it finishes, whatever the balance is by then.
    end if;
  end if;

  r := public.ai_quota_reserve_v2_core(p_user, p_chat, p_feature, p_est);
  if not (r ->> 'allowed')::boolean then return r; end if;

  update public.ai_reservations
    set use_sparks = v_use_sparks, sparks = case when v_use_sparks then 1 else 0 end, advisor_free = coalesce(p_advisor_free, false)
    where id = (r ->> 'reservation_id')::uuid;
  if v_credit and not v_use_sparks then
    insert into public.ai_credit_sessions (user_id, session_start) values (p_user, t)
    on conflict (user_id) do update set session_start = excluded.session_start
      where public.ai_credit_sessions.session_start + interval '5 hours' <= t;
  end if;
  return r;
end;
$$;

drop function if exists public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text);
drop function if exists public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text);
create or replace function public.ai_quota_settle_core(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return 0; end if;
  update public.ai_reservations set settled = true where id = p_reservation;
  v_cost := public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out, p_audio_seconds, p_extra_cost_micro);
  insert into public.ai_usage_events (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro, credits_exempt)
  values (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, p_units, p_latency, p_status, v_cost, r.advisor_free);
  if r.chat_id is not null then
    update public.ai_chats set units = units + p_units, turns = turns + case when r.feature = 'chat' and p_status = 'ok' then 1 else 0 end, last_at = now()
      where chat_id = r.chat_id;
  end if;
  return v_cost;
end;
$$;
create or replace function public.ai_quota_settle(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return; end if;
  v_cost := public.ai_quota_settle_core(p_reservation, p_user, p_units, p_in, p_cached, p_out, p_model, p_tier, p_latency, p_status, p_audio_seconds, p_extra_cost_micro);
  -- A request that started at or over a limit is paid in Sparks at its real cost; the request that crossed the limit is not charged.
  if r.use_sparks and (p_status = 'ok' or (p_status = 'aborted' and coalesce(p_out, 0) > 0)) then
    perform public.spark_charge(p_user, greatest(1, ceil(v_cost / 1000.0)::integer), p_reservation, r.feature);
  end if;
  -- The monthly free Advisor answer is used up only when the answer arrives.
  if r.advisor_free and r.feature = 'chat' and p_status = 'ok' then
    insert into public.advisor_free_uses (user_id) values (p_user);
  end if;
end;
$$;
revoke all on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric, boolean) from public, anon, authenticated;
revoke all on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint) from public, anon, authenticated;
revoke all on function public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint) from public, anon, authenticated;
revoke all on function public.ai_credit_windows(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric, boolean), public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint),
  public.ai_quota_settle_core(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint), public.ai_credit_windows(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------- the Advisor gate
-- Whether the Advisor (the smart tier in chat) is open to this user, and what is left of the free monthly answer.
create or replace function public.advisor_gate(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_ent public.user_entitlements%rowtype; L jsonb := public.ai_effective_limits(p_user);
  v_in_plan boolean := false; v_total numeric; v_used integer := 0; tz text; v_month timestamptz;
begin
  if not public.billing_enabled() then return jsonb_build_object('entitled', true, 'free_left', 0, 'free_total', 0); end if;
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, now()) then
    select 'buddgy_advisor' = any(p.features) into v_in_plan from public.plans p where p.key = v_ent.plan_key;
    if coalesce(v_ent.feature_overrides -> 'buddgy_advisor', 'true'::jsonb) = 'false'::jsonb then v_in_plan := false; end if;
  end if;
  if coalesce(v_in_plan, false) then return jsonb_build_object('entitled', true, 'free_left', 0, 'free_total', 0); end if;
  v_total := coalesce((L ->> 'advisor_free_per_month')::numeric, 0);
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.user_settings where user_id = p_user;
  tz := coalesce(tz, 'UTC');
  begin v_month := date_trunc('month', now() at time zone tz) at time zone tz; exception when others then v_month := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'; end;
  select count(*) into v_used from public.advisor_free_uses where user_id = p_user and used_at >= v_month;
  return jsonb_build_object('entitled', false, 'free_left', greatest(v_total - v_used, 0), 'free_total', v_total);
end;
$$;
revoke all on function public.advisor_gate(uuid) from public, anon, authenticated;
grant execute on function public.advisor_gate(uuid) to service_role;

-- ---------------------------------------------------------------- budget plans
create or replace function public.budget_plans_limit()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_max numeric; v_count integer;
begin
  if new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.deleted_at is null then return new; end if;
  if not public.billing_enabled() then return new; end if;
  v_max := (public.ai_effective_limits(new.user_id) ->> 'budget_plans_max')::numeric;
  if v_max is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('plans:' || new.user_id::text, 0));
  select count(*) into v_count from public.budget_plans p where p.user_id = new.user_id and p.deleted_at is null and p.id <> new.id;
  if v_count >= v_max then
    raise exception 'budget_plans_max' using errcode = '23514', detail = 'The plan limit of this account is reached.';
  end if;
  return new;
end;
$$;
drop trigger if exists budget_plans_limit on public.budget_plans;
create trigger budget_plans_limit before insert or update of deleted_at on public.budget_plans for each row execute function public.budget_plans_limit();

-- ---------------------------------------------------------------- live balance views
-- Opening one account's live balance card. A view counts only when it shows a bank-confirmed balance; the same account within 24 hours is free.
create or replace function public.balance_view(p_payment_method uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  u uuid := auth.uid(); tz text; v_month timestamptz; v_next timestamptz; v_limit numeric; v_used integer; v_counted boolean := false; v_reports jsonb;
begin
  if u is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.payment_methods where id = p_payment_method and user_id = u) then return jsonb_build_object('status', 'not_found'); end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.reported_at desc), '[]'::jsonb) into v_reports from (
    select balance, currency, reported_at, source from public.account_balance_reports where user_id = u and payment_method_id = p_payment_method order by reported_at desc limit 2) x;
  if jsonb_array_length(v_reports) = 0 then return jsonb_build_object('status', 'empty'); end if;
  perform pg_advisory_xact_lock(hashtextextended('bview:' || u::text, 0));
  select coalesce(nullif(timezone, ''), 'UTC') into tz from public.user_settings where user_id = u;
  tz := coalesce(tz, 'UTC');
  begin v_month := date_trunc('month', now() at time zone tz) at time zone tz; v_next := (date_trunc('month', now() at time zone tz) + interval '1 month') at time zone tz;
  exception when others then v_month := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'; v_next := (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'; end;
  v_limit := case when public.billing_enabled() then (public.ai_effective_limits(u) ->> 'balance_views_per_month')::numeric else null end;
  select count(*) into v_used from public.balance_views where user_id = u and viewed_at >= v_month;
  if not exists (select 1 from public.balance_views where user_id = u and payment_method_id = p_payment_method and viewed_at > now() - interval '24 hours') then
    if v_limit is not null and v_used >= v_limit then
      return jsonb_build_object('status', 'limit', 'used', v_used, 'limit', v_limit, 'reset_at', v_next);
    end if;
    insert into public.balance_views (user_id, payment_method_id) values (u, p_payment_method);
    v_used := v_used + 1; v_counted := true;
  end if;
  return jsonb_build_object('status', 'ok', 'counted', v_counted, 'used', v_used, 'limit', v_limit, 'reset_at', v_next, 'reports', v_reports);
end;
$$;
revoke all on function public.balance_view(uuid) from public, anon;
grant execute on function public.balance_view(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- interest in what is coming
create or replace function public.coming_soon_notify(p_feature text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.coming_soon_interest (user_id, feature) values (auth.uid(), p_feature) on conflict do nothing;
end;
$$;
revoke all on function public.coming_soon_notify(text) from public, anon;
grant execute on function public.coming_soon_notify(text) to authenticated, service_role;

-- ---------------------------------------------------------------- staff resets
create or replace function public.usage_reset(p_user uuid, p_scope text, p_actor uuid, p_reason text)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.ai_credit_resets (user_id, scope, granted_by, reason) values (p_user, p_scope, p_actor, left(p_reason, 200))
$$;
revoke all on function public.usage_reset(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.usage_reset(uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------- Sparks packs
-- A pack purchase adds its Sparks, plus the Pro bonus for a paying Pro member; the same transaction id never pays twice.
create or replace function public.spark_pack_grant(p_user uuid, p_store text, p_txn text, p_product text, p_price_micros bigint, p_currency text, p_at timestamptz)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_sparks integer; v_pct integer; v_bonus integer := 0; v_ent public.user_entitlements%rowtype;
begin
  select sparks into v_sparks from public.spark_products where product_id = p_product and active;
  if v_sparks is null then return 0; end if;
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if found and v_ent.plan_key = 'plus' and public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, p_at) then
    select coalesce((value ->> 'proPercent')::integer, 0) into v_pct from public.platform_settings where key = 'sparks_bonus';
    v_bonus := floor(v_sparks * coalesce(v_pct, 0) / 100.0)::integer;
  end if;
  insert into public.spark_purchases (user_id, store, store_txn, product_id, sparks, remaining, price_micros, currency, purchased_at)
  values (p_user, p_store, p_txn, p_product, v_sparks + v_bonus, v_sparks + v_bonus, p_price_micros, p_currency, p_at)
  on conflict (store_txn) do nothing;
  if not found then return 0; end if;
  return v_sparks + v_bonus;
end;
$$;
-- A refund removes the unspent Sparks of that purchase; what was already spent stays spent.
create or replace function public.spark_pack_refund(p_store_txn text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_left integer;
begin
  update public.spark_purchases set refunded_at = now(), remaining = 0 where store_txn = p_store_txn and refunded_at is null returning remaining into v_left;
  return coalesce(v_left, 0);
end;
$$;
revoke all on function public.spark_pack_grant(uuid, text, text, text, bigint, text, timestamptz), public.spark_pack_refund(text) from public, anon, authenticated;
grant execute on function public.spark_pack_grant(uuid, text, text, text, bigint, text, timestamptz), public.spark_pack_refund(text) to service_role;

-- billing_apply: a pack event adds or removes Sparks; the receipt fields are kept on the log; the monthly allowance is retired.
create or replace function public.billing_apply(p_user uuid, p_event_id text, p_type text, p_event_ms bigint, p_effect jsonb)
returns text language plpgsql security definer set search_path to 'public' as $$
declare
  v_at timestamptz := to_timestamp(p_event_ms / 1000.0);
  v_n integer; v_last timestamptz; v_granted integer;
  e jsonb := p_effect -> 'entitlement';
  s jsonb := p_effect -> 'sparks';
  pk jsonb := p_effect -> 'pack';
  rc jsonb := p_effect -> 'receipt';
  v_from uuid;
begin
  insert into public.billing_events (provider, event_id, type, user_id, event_at, store, product_id, price_micros, currency)
  values ('revenuecat', p_event_id, p_type, p_user, v_at, rc ->> 'store', rc ->> 'product_id', (rc ->> 'price_micros')::bigint, rc ->> 'currency')
  on conflict (provider, event_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'duplicate'; end if;

  perform pg_advisory_xact_lock(hashtextextended('billing:' || p_user::text, 0));

  if pk is not null then
    if pk ->> 'action' = 'purchase' then
      v_granted := public.spark_pack_grant(p_user, pk ->> 'store', pk ->> 'store_txn', pk ->> 'product_id', (pk ->> 'price_micros')::bigint, pk ->> 'currency', v_at);
    elsif pk ->> 'action' = 'refund' then
      perform public.spark_pack_refund(pk ->> 'store_txn');
    end if;
    update public.billing_events set outcome = 'applied' where provider = 'revenuecat' and event_id = p_event_id;
    return 'applied';
  end if;

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
        v_granted := coalesce((s ->> 'granted')::integer, (select (limits ->> 'sparks_per_month')::integer from public.plans where key = 'plus'), 0);
        if v_granted > 0 then perform public.spark_open_plan_period(p_user, (s ->> 'start')::timestamptz, (s ->> 'end')::timestamptz, v_granted, s ->> 'ref'); end if;
      when 'end' then perform public.spark_end_plan_period(p_user, v_at);
      when 'restore' then perform public.spark_restore_plan_period(p_user);
      else null;
    end case;
  end if;

  update public.billing_events set outcome = 'applied' where provider = 'revenuecat' and event_id = p_event_id;
  return 'applied';
end;
$$;

-- ---------------------------------------------------------------- trial: 30 days at Pro limits, no Sparks
create or replace function public.trial_claim(p_user uuid, p_email_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_days integer; v_end timestamptz; v_cap integer; v_n integer; v_ent public.user_entitlements%rowtype;
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
  v_end := now() + make_interval(days => coalesce(v_days, 30));
  insert into public.user_entitlements (user_id, plan_key, status, source, trial_ends_at, current_period_end, note)
  values (p_user, 'plus_trial', 'trialing', 'default', v_end, null, 'S6: 30-day trial')
  on conflict (user_id) do update
    set plan_key = 'plus_trial', status = 'trialing', source = 'default', trial_ends_at = v_end, current_period_end = null,
        canceled_at = null, note = 'S6: 30-day trial', updated_at = now();
  return jsonb_build_object('status', 'granted', 'trial_ends_at', v_end);
end;
$$;

-- ---------------------------------------------------------------- one read for the app: /api/entitlements/me
create or replace function public.ai_usage_state(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  L jsonb := public.ai_effective_limits(p_user); w jsonb := public.ai_credit_windows(p_user, now());
  s_lim numeric := (L ->> 'ai_credits_session')::numeric; w_lim numeric := (L ->> 'ai_credits_week')::numeric;
  tz text := w ->> 'timezone'; v_month timestamptz; v_next timestamptz; v_views integer; v_vlim numeric := (L ->> 'balance_views_per_month')::numeric;
begin
  begin v_month := date_trunc('month', now() at time zone tz) at time zone tz; v_next := (date_trunc('month', now() at time zone tz) + interval '1 month') at time zone tz;
  exception when others then v_month := date_trunc('month', now()); v_next := v_month + interval '1 month'; end;
  select count(*) into v_views from public.balance_views where user_id = p_user and viewed_at >= v_month;
  return jsonb_build_object(
    'session', jsonb_build_object('used', round((w ->> 'session_used')::numeric, 2), 'limit', s_lim, 'resetAt', w -> 'session_reset',
      'pct', case when s_lim is null or s_lim = 0 then null else least(100, round((w ->> 'session_used')::numeric / s_lim * 100)) end),
    'week', jsonb_build_object('used', round((w ->> 'week_used')::numeric, 2), 'limit', w_lim, 'resetAt', w -> 'week_reset',
      'pct', case when w_lim is null or w_lim = 0 then null else least(100, round((w ->> 'week_used')::numeric / w_lim * 100)) end),
    'byFeature', coalesce((select jsonb_object_agg(feature, c) from (
        select feature, round(sum(cost_usd_micro) / 1000.0, 2) c from public.ai_usage_events
        where user_id = p_user and feature <> 'sms' and not credits_exempt and created_at >= (w ->> 'week_start')::timestamptz group by feature) x), '{}'::jsonb),
    'sparksLeft', public.spark_available(p_user, now()),
    'balanceViews', jsonb_build_object('used', v_views, 'limit', v_vlim, 'resetAt', v_next),
    'plans', jsonb_build_object('used', (select count(*) from public.budget_plans where user_id = p_user and deleted_at is null), 'limit', (L ->> 'budget_plans_max')::numeric),
    'advisor', public.advisor_gate(p_user),
    'resetsUnseen', coalesce((select jsonb_agg(scope order by created_at desc) from public.ai_credit_resets where user_id = p_user and seen_at is null), '[]'::jsonb),
    'interest', coalesce((select jsonb_agg(feature) from public.coming_soon_interest where user_id = p_user), '[]'::jsonb)
  );
end;
$$;
create or replace function public.usage_resets_seen(p_user uuid)
returns void language sql security definer set search_path to 'public' as $$
  update public.ai_credit_resets set seen_at = now() where user_id = p_user and seen_at is null
$$;
revoke all on function public.ai_usage_state(uuid), public.usage_resets_seen(uuid) from public, anon, authenticated;
grant execute on function public.ai_usage_state(uuid), public.usage_resets_seen(uuid) to service_role;
