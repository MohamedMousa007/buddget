-- S6 phase 1 (S5c section 14, items 4 to 7): spend guard, plan rows and limit keys, SMS counted per call.
-- Checked before writing (live, 2026-11-15): 47 accounts, no user_entitlements rows, 12 accounts have AI usage, none
-- above the Plus limits below; one is above the free AI limits. Every existing account is therefore given the free Plus
-- preview (source 'promo') in this same migration, so no tester gets less than today.

-- 4. Daily AI spend cap (a missing row meant no cap).
insert into public.platform_settings (key, value)
values ('ai_spend_guard', '{"dailyCapUsd": 5}'::jsonb)
on conflict (key) do nothing;

-- The one server-side switch for selling. Off: no paywall, no purchase entry points, no enforcement of paid gates.
insert into public.platform_settings (key, value)
values ('billing', '{"enabled": false}'::jsonb)
on conflict (key) do nothing;

create or replace function public.billing_enabled()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'billing'), false)
$$;
revoke all on function public.billing_enabled() from public, anon, authenticated;
grant execute on function public.billing_enabled() to service_role;

-- 5. Every limit key the SQL merge may carry. An unknown key is dropped by ai_effective_limits, so each new key is listed here.
create or replace function public.ai_default_limits()
returns jsonb
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'ai_chat_units_soft', 30000,
    'ai_chat_units_hard', 60000,
    'ai_chat_turns', 40,
    'ai_chats_per_hour', 30,
    'ai_chats_per_day', 100,
    'ai_units_5h', 600000,
    'ai_units_24h', 1500000,
    'ai_units_7d', 6000000,
    'ai_req_per_min', 30,
    'ai_idle_minutes', 30,
    'ai_chat_per_day', null,
    'receipt_scans_per_month', null,
    'voice_entries_per_day', null,
    'grounded_per_day', 3,
    'sparks_per_month', 20,
    'sms_ai_calls_per_day', 30,
    'sms_ai_calls_per_month', 150,
    'sms_accounts_max', null,
    'budget_plans_max', null,
    'seats', 1
  )
$$;

update public.plans
set limits = limits || '{
  "sparks_per_month": 20, "sms_accounts_max": 2, "budget_plans_max": 2, "seats": 1,
  "sms_ai_calls_per_day": 30, "sms_ai_calls_per_month": 150, "grounded_per_day": 3,
  "ai_units_5h": 40000, "ai_units_24h": 60000, "ai_units_7d": 200000, "ai_req_per_min": 10
}'::jsonb
where key = 'free';

insert into public.plans (key, name, description, status, is_default, price_monthly_cents, price_yearly_cents, currency, trial_days, limits, features, sort_order)
values
  ('plus', 'Plus', 'Unlimited SMS-tracked accounts, 100 Sparks a month, advanced reports.', 'active', false, 6900, 49900, 'EGP', 14,
   '{"sparks_per_month": 100, "sms_accounts_max": null, "budget_plans_max": null, "seats": 1,
     "sms_ai_calls_per_day": 60, "sms_ai_calls_per_month": 450, "grounded_per_day": 10,
     "ai_units_5h": 120000, "ai_units_24h": 200000, "ai_units_7d": 450000, "ai_req_per_min": 20}'::jsonb,
   array['advanced_reports', 'budget_compare', 'budget_stress_test'], 1),
  ('plus_trial', 'Plus trial', 'The 14-day trial of Plus. Never listed on the paywall; no store products.', 'active', false, 0, 0, 'EGP', 14,
   '{"sparks_per_month": 60, "sms_accounts_max": null, "budget_plans_max": null, "seats": 1,
     "sms_ai_calls_per_day": 60, "sms_ai_calls_per_month": 250, "grounded_per_day": 3,
     "ai_units_5h": 60000, "ai_units_24h": 100000, "ai_units_7d": 300000, "ai_req_per_min": 20}'::jsonb,
   array['advanced_reports', 'budget_compare', 'budget_stress_test'], 2)
on conflict (key) do nothing;

-- Free Plus preview for every account that exists today (S5a section 7). The end date is a safety net: the launch
-- migration moves it to launch day.
insert into public.user_entitlements (user_id, plan_key, status, source, current_period_end, note)
select u.id, 'plus', 'active', 'promo', '2027-02-01T00:00:00Z', 'S6: free Plus preview for pre-launch accounts'
from auth.users u
where not exists (select 1 from public.user_entitlements e where e.user_id = u.id);

-- 6. SMS is counted per model call (day and month) and no longer spends the unit windows.
create or replace function public.ai_quota_reserve_v2(p_user uuid, p_chat uuid, p_feature text, p_est numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  L jsonb := public.ai_effective_limits(p_user);
  t timestamptz := now();
  v_hop boolean := p_feature = 'chat_hop';
  v_base text := case when p_feature = 'chat_hop' then 'chat' else p_feature end;
  v_chat public.ai_chats%rowtype;
  v_chat_id uuid;
  v_new boolean := false;
  v_rolled boolean := false;
  v_soft boolean := false;
  v_cnt numeric;
  v_first timestamptz;
  v_used numeric;
  v_res uuid;
  w record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if jsonb_exists(L -> 'disabled', v_base) then
    return jsonb_build_object('allowed', false, 'layer', 'feature_disabled');
  end if;

  select count(*), min(x.created_at) into v_cnt, v_first from (
    select created_at from public.ai_usage_events where user_id = p_user and created_at > t - interval '60 seconds'
    union all
    select created_at from public.ai_reservations where user_id = p_user and not settled and created_at > t - interval '60 seconds'
  ) x;
  if v_cnt >= (L ->> 'ai_req_per_min')::numeric then
    return jsonb_build_object('allowed', false, 'layer', 'rate', 'reset_at', v_first + interval '60 seconds');
  end if;

  if p_feature = 'sms' then
    if (L ->> 'sms_ai_calls_per_day') is not null then
      select count(*), min(x.created_at) into v_cnt, v_first from (
        select created_at from public.ai_usage_events where user_id = p_user and feature = 'sms' and created_at > t - interval '24 hours'
        union all
        select created_at from public.ai_reservations where user_id = p_user and feature = 'sms' and not settled and expires_at > t
      ) x;
      if v_cnt >= (L ->> 'sms_ai_calls_per_day')::numeric then
        return jsonb_build_object('allowed', false, 'layer', 'sms_day', 'reset_at', v_first + interval '24 hours');
      end if;
    end if;
    if (L ->> 'sms_ai_calls_per_month') is not null then
      select count(*), min(x.created_at) into v_cnt, v_first from (
        select created_at from public.ai_usage_events where user_id = p_user and feature = 'sms' and created_at > t - interval '30 days'
        union all
        select created_at from public.ai_reservations where user_id = p_user and feature = 'sms' and not settled and expires_at > t
      ) x;
      if v_cnt >= (L ->> 'sms_ai_calls_per_month')::numeric then
        return jsonb_build_object('allowed', false, 'layer', 'sms_month', 'reset_at', v_first + interval '30 days');
      end if;
    end if;
  end if;

  if p_feature = 'chat' and (L ->> 'ai_chat_per_day') is not null then
    select count(*), min(x.created_at) into v_cnt, v_first from (
      select created_at from public.ai_usage_events where user_id = p_user and feature = 'chat' and status = 'ok' and created_at > t - interval '24 hours'
      union all
      select created_at from public.ai_reservations where user_id = p_user and feature = 'chat' and not settled and expires_at > t
    ) x;
    if v_cnt >= (L ->> 'ai_chat_per_day')::numeric then
      return jsonb_build_object('allowed', false, 'layer', 'chat_messages_day', 'reset_at', v_first + interval '24 hours');
    end if;
  end if;
  if p_feature = 'receipt' and (L ->> 'receipt_scans_per_month') is not null then
    select count(*), min(x.created_at) into v_cnt, v_first from (
      select created_at from public.ai_usage_events where user_id = p_user and feature = 'receipt' and status = 'ok' and created_at > t - interval '30 days'
      union all
      select created_at from public.ai_reservations where user_id = p_user and feature = 'receipt' and not settled and expires_at > t
    ) x;
    if v_cnt >= (L ->> 'receipt_scans_per_month')::numeric then
      return jsonb_build_object('allowed', false, 'layer', 'receipts_month', 'reset_at', v_first + interval '30 days');
    end if;
  end if;
  if p_feature = 'voice' and (L ->> 'voice_entries_per_day') is not null then
    select count(*), min(x.created_at) into v_cnt, v_first from (
      select created_at from public.ai_usage_events where user_id = p_user and feature = 'voice' and status = 'ok' and created_at > t - interval '24 hours'
      union all
      select created_at from public.ai_reservations where user_id = p_user and feature = 'voice' and not settled and expires_at > t
    ) x;
    if v_cnt >= (L ->> 'voice_entries_per_day')::numeric then
      return jsonb_build_object('allowed', false, 'layer', 'voice_day', 'reset_at', v_first + interval '24 hours');
    end if;
  end if;

  if v_base = 'chat' then
    if p_chat is not null then
      select * into v_chat from public.ai_chats where chat_id = p_chat and user_id = p_user;
    end if;

    if v_hop then
      if v_chat.chat_id is null
         or v_chat.closed
         or v_chat.last_at < t - interval '10 minutes'
         or v_chat.units >= (L ->> 'ai_chat_units_hard')::numeric * 1.5
         or (select count(*) from (select 1 from public.ai_usage_events where chat_id = v_chat.chat_id and feature = 'chat_hop' union all select 1 from public.ai_reservations where chat_id = v_chat.chat_id and feature = 'chat_hop' and not settled and expires_at > t) h) >= (v_chat.turns + 1) * 3 -- chat_hop cap
         then
        return jsonb_build_object('allowed', false, 'layer', 'rate', 'reset_at', t + interval '60 seconds');
      end if;
      v_chat_id := v_chat.chat_id;
    else
      if v_chat.chat_id is null
         or v_chat.closed
         or v_chat.last_at < t - ((L ->> 'ai_idle_minutes')::float8 * interval '1 minute') then
        v_new := true;
      elsif v_chat.turns >= (L ->> 'ai_chat_turns')::numeric
         or v_chat.units >= (L ->> 'ai_chat_units_hard')::numeric then
        update public.ai_chats set closed = true where chat_id = v_chat.chat_id;
        v_new := true;
        v_rolled := true;
      else
        v_chat_id := v_chat.chat_id;
        v_soft := v_chat.units >= (L ->> 'ai_chat_units_soft')::numeric;
      end if;

      if v_new then
        select count(*), min(started_at) into v_cnt, v_first
        from public.ai_chats where user_id = p_user and started_at > t - interval '1 hour';
        if v_cnt >= (L ->> 'ai_chats_per_hour')::numeric then
          return jsonb_build_object('allowed', false, 'layer', 'chats_hour', 'reset_at', v_first + interval '1 hour');
        end if;
        select count(*), min(started_at) into v_cnt, v_first
        from public.ai_chats where user_id = p_user and started_at > t - interval '24 hours';
        if v_cnt >= (L ->> 'ai_chats_per_day')::numeric then
          return jsonb_build_object('allowed', false, 'layer', 'chats_day', 'reset_at', v_first + interval '24 hours');
        end if;
      end if;
    end if;
  end if;

  if p_feature <> 'sms' then
    for w in
      select * from (values
        ('window_5h', interval '5 hours', 'ai_units_5h'),
        ('window_24h', interval '24 hours', 'ai_units_24h'),
        ('window_7d', interval '7 days', 'ai_units_7d')
      ) as v(layer, span, limit_key)
    loop
      select coalesce(sum(x.units), 0), min(x.created_at) into v_used, v_first from (
        select units, created_at from public.ai_usage_events
          where user_id = p_user and feature <> 'sms' and created_at > t - w.span
        union all
        select est_units, created_at from public.ai_reservations
          where user_id = p_user and feature <> 'sms' and not settled and expires_at > t and created_at > t - w.span
      ) x;
      if v_used >= (L ->> w.limit_key)::numeric then
        return jsonb_build_object('allowed', false, 'layer', w.layer, 'reset_at', v_first + w.span);
      end if;
    end loop;
  end if;

  if v_new then
    insert into public.ai_chats (user_id) values (p_user) returning chat_id into v_chat_id;
  end if;

  insert into public.ai_reservations (user_id, chat_id, feature, est_units, expires_at)
  values (p_user, v_chat_id, p_feature, greatest(p_est, 0), t + interval '3 minutes')
  returning id into v_res;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', v_res,
    'chat_id', v_chat_id,
    'new_chat', v_new,
    'rolled', v_rolled,
    'soft', v_soft,
    'disabled', L -> 'disabled'
  );
end;
$function$;
