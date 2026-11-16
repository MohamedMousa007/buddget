-- 0302_ai_credits_plain_sums.sql  (DB backend audit, 2026-11-16: credit windows back to plain sums before billing is switched on)
--
-- 0301 kept per-user running totals (ai_credit_counters) beside ai_usage_events. They were equal to the sums by construction, but they
-- were a second source of truth on the billing path that saved a sum over a few hundred rows. This restores the 0298 bodies of
-- ai_credit_windows and ai_quota_settle_core verbatim (the sums run on ai_usage_events_user_cover_idx, which stays) and drops the
-- counter table and its two helpers. Privileges are kept by CREATE OR REPLACE.
--
-- AUDIT SELECT (before applying; expected today in brackets):
--   select count(*) from ai_credit_counters;   -- [0]: billing is off, nothing has settled through the counter yet
-- ROLLBACK: re-run section 2 of 0301_db_load_phase_b.sql (table, ai_credit_cuts, ai_credit_windows, ai_credit_bump, ai_quota_settle_core).

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

drop function if exists public.ai_credit_bump(uuid, bigint);
drop function if exists public.ai_credit_cuts(uuid, timestamptz);
drop table if exists public.ai_credit_counters;
