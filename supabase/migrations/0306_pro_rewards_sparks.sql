-- Pro, Rewards, Founders and Invites (docs/launch/PRO_REWARDS_SPEC.md section 1): new Sparks packs, the pack bonus with the
-- loyal-Pro rate, a `reward` Sparks bucket (12 months, spent before bought Sparks), and the Egypt Pro AI limits.
--
-- AUDIT SELECT (live, 2026-11-17, before applying):
--   select count(*) from spark_purchases;                       -- 0: no pack was ever sold, the old product rows can go
--   select count(*) from spark_allowances;                      -- 2 (plan rows); untouched
--   select count(*) from profiles where base_currency = 'EGP';  -- 30 of 48

-- ---------------------------------------------------------------- packs
delete from public.spark_products where product_id in ('sparks_70', 'sparks_150', 'sparks_400', 'sparks_900', 'sparks_2500');
insert into public.spark_products (product_id, sparks, countries, active) values
  ('sparks_60', 60, array['EG'], true), ('sparks_125', 125, array['EG'], true),
  ('sparks_320', 320, null, true), ('sparks_650', 650, null, true), ('sparks_2000', 2000, null, true)
on conflict (product_id) do update set sparks = excluded.sparks, countries = excluded.countries, active = true;

insert into public.platform_settings (key, value) values
  ('sparks_bonus', '{"proPercent": 15, "loyalProPercent": 20, "loyalMinTier": "diamond"}'::jsonb),
  ('spark_gifts', '{"enabled": true}'::jsonb),
  ('pro_regional_limits', '{"EG": {"ai_credits_week": 100, "sms_ai_calls_per_month": 300}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ---------------------------------------------------------------- the reward bucket
alter table public.spark_allowances drop constraint if exists spark_allowances_kind_check;
alter table public.spark_allowances add constraint spark_allowances_kind_check check (kind in ('plan', 'trial', 'bonus', 'reward'));
alter table public.spark_allowances add column if not exists reason text;
-- A gift pays once per ref (tier:emerald, streak:12, referral:<id>, admin:<uuid>).
create unique index if not exists spark_allowances_reward_ref_uidx on public.spark_allowances (user_id, ref) where kind = 'reward';

alter table public.spark_purchases add column if not exists bonus_sparks integer not null default 0 check (bonus_sparks >= 0);
alter table public.spark_purchases drop constraint if exists spark_purchases_store_check;
-- 'admin' = a purchased-type test grant made from the admin portal.
alter table public.spark_purchases add constraint spark_purchases_store_check check (store in ('app_store', 'play_store', 'admin'));
-- The purchase history on the Pro page reads both by user, newest first.
create index if not exists spark_purchases_user_at_idx on public.spark_purchases (user_id, purchased_at desc);
create index if not exists billing_events_user_at_idx on public.billing_events (user_id, event_at desc) where user_id is not null;

-- Reward Sparks: a 12-month allowance row. Spent before bought Sparks because spark_charge drains allowances first (soonest
-- expiry first). `p_gift` rows obey the spark_gifts switch; admin grants do not. Returns the Sparks granted (0 = already paid or off).
create or replace function public.spark_grant_reward(p_user uuid, p_sparks integer, p_ref text, p_reason text, p_gift boolean default true)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_n integer; v_t timestamptz := clock_timestamp();
begin
  if p_sparks <= 0 or p_ref is null then return 0; end if;
  if p_gift and not coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'spark_gifts'), true) then return 0; end if;
  insert into public.spark_allowances (user_id, kind, granted, period_start, period_end, ref, reason)
  values (p_user, 'reward', p_sparks, v_t, v_t + interval '12 months', p_ref, left(p_reason, 200))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then p_sparks else 0 end;
end;
$$;

-- The pack bonus in percent for a user now: paying Pro (plan `plus` that grants; the trial does not) gets proPercent, and a
-- Pro member at loyalMinTier or above gets loyalProPercent. The larger of the two, never added. Free gets 0.
-- Mirrored in src/lib/billing/packBonus.ts.
create or replace function public.spark_pack_bonus_percent(p_user uuid, p_at timestamptz default now())
returns integer language plpgsql stable security definer set search_path to 'public' as $$
declare v_ent record; s jsonb; v_rank integer; v_min integer;
begin
  select plan_key, status, trial_ends_at, current_period_end, grace_ends_at into v_ent from public.user_entitlements where user_id = p_user;
  if not found or v_ent.plan_key <> 'plus' or not public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, p_at) then
    return 0;
  end if;
  select value into s from public.platform_settings where key = 'sparks_bonus';
  select t.sort_order into v_rank from public.loyalty_accounts a join public.loyalty_tiers t on t.key = a.tier_key where a.user_id = p_user;
  select t.sort_order into v_min from public.loyalty_tiers t where t.key = coalesce(s ->> 'loyalMinTier', 'diamond');
  return greatest(coalesce((s ->> 'proPercent')::integer, 0),
                  case when v_rank is not null and v_min is not null and v_rank >= v_min then coalesce((s ->> 'loyalProPercent')::integer, 0) else 0 end);
end;
$$;

-- A pack purchase adds its Sparks plus the bonus in one row, so a refund (spark_pack_refund zeroes `remaining`) claws the bonus back with the pack.
create or replace function public.spark_pack_grant(p_user uuid, p_store text, p_txn text, p_product text, p_price_micros bigint, p_currency text, p_at timestamptz)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_sparks integer; v_bonus integer; v_n integer;
begin
  select sparks into v_sparks from public.spark_products where product_id = p_product and active;
  if v_sparks is null then return 0; end if;
  v_bonus := floor(v_sparks * public.spark_pack_bonus_percent(p_user, p_at) / 100.0)::integer;
  insert into public.spark_purchases (user_id, store, store_txn, product_id, sparks, remaining, bonus_sparks, price_micros, currency, purchased_at)
  values (p_user, p_store, p_txn, p_product, v_sparks + v_bonus, v_sparks + v_bonus, v_bonus, p_price_micros, p_currency, p_at)
  on conflict (store_txn) do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 0; end if;
  return v_sparks + v_bonus;
end;
$$;

-- ---------------------------------------------------------------- Egypt Pro limits
alter table public.user_entitlements add column if not exists store_country text;

-- Pro and the trial, for a member whose store country is EG or whose base currency is EGP, take the lower of the plan value
-- and pro_regional_limits.EG (100 credits a week, 300 SMS AI calls a month). Applied before the per-user overrides, which still win.
-- Only primary-key reads are added (profiles by id, platform_settings by key).
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
  v_region jsonb;
  layer jsonb;
  k text;
  v jsonb;
  mapped text;
begin
  select * into v_ent from public.user_entitlements where user_id = p_user;
  if v_ent.user_id is not null then
    if public.entitlement_grants(v_ent.status, v_ent.trial_ends_at, v_ent.current_period_end, v_ent.grace_ends_at, now()) then
      select p.limits into v_limits from public.plans p where p.key = v_ent.plan_key;
      if v_limits is not null and v_ent.plan_key in ('plus', 'plus_trial')
         and (upper(coalesce(v_ent.store_country, '')) = 'EG' or exists (select 1 from public.profiles pr where pr.id = p_user and pr.base_currency::text = 'EGP')) then
        select value -> 'EG' into v_region from public.platform_settings where key = 'pro_regional_limits';
        if v_region is not null and jsonb_typeof(v_region) = 'object' then
          for k, v in select * from jsonb_each(v_region) loop
            if jsonb_typeof(v) = 'number' then
              v_limits := v_limits || jsonb_build_object(k,
                case when jsonb_typeof(v_limits -> k) = 'number' then least((v_limits ->> k)::numeric, (v #>> '{}')::numeric) else (v #>> '{}')::numeric end);
            end if;
          end loop;
        end if;
      end if;
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

-- billing_apply: unchanged except that an event carrying `country` stores the store country on the entitlement.
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
  if nullif(p_effect ->> 'country', '') is not null then
    update public.user_entitlements set store_country = upper(left(p_effect ->> 'country', 2)) where user_id = p_user;
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

revoke all on function public.spark_grant_reward(uuid, integer, text, text, boolean), public.spark_pack_bonus_percent(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.spark_grant_reward(uuid, integer, text, text, boolean), public.spark_pack_bonus_percent(uuid, timestamptz) to service_role;
