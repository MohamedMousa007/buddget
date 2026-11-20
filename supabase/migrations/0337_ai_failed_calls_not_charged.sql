-- BDG-011 slice 1: a model call that put nothing in front of the user is logged, not charged.
-- "Nothing reached the user" is a settle status of 'error' (provider failure, empty reply, safety block) or
-- 'aborted_empty' (stream cut or Stop before any text; a status only the new server sends). Such a row keeps its
-- real tokens and cost_usd_micro, but is written with units = 0 and credits_exempt = true, and adds nothing to
-- ai_chats.units. Every reader then agrees without being touched: the credit windows (ai_credit_windows skips
-- exempt rows), the rolling unit windows and ai_quota_status (they sum units), and Sparks (ai_quota_settle charges
-- only 'ok', or 'aborted' with output). The per-minute rate limit counts rows, so it still counts these.
-- 'ok' and 'aborted' are unchanged, so the server already deployed behaves as before except that 'error' is free.
-- Other features settle through the same function on purpose: a budget build, receipt scan or voice entry that
-- returned nothing ('error') is free too; '/api/ai' already zeroes grounding cost on 'error'.
-- ponytail: a prompt the provider blocks on safety is now free, so it can be repeated at no credit cost. Ceiling: the
-- per-minute rate limit (10 a minute on Free) still counts it, and each call costs us about 8k cheap input tokens.
-- Upgrade path if abuse shows in ai_usage_events: charge 'error' rows whose out_tokens > 0, or cap free errors per hour.
-- Same signature: no overload, grants unchanged (service_role only, 0315).
-- Proof on live before applying (one rolled-back transaction, 2026-11-20): ok and aborted charged 5000 units and
-- 2.5 credits each; error and aborted_empty charged 0 units and 0 credits with the cost logged; chat units 10000;
-- 4 rows counted by the rate limit.
-- Rollback: re-run ai_quota_settle_core from 0302_ai_credits_plain_sums.sql.

create or replace function public.ai_quota_settle_core(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint;
  v_free boolean := coalesce(p_status in ('error', 'aborted_empty'), false);
  v_units numeric := case when v_free then 0 else p_units end;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return 0; end if;
  update public.ai_reservations set settled = true where id = p_reservation;
  v_cost := public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out, p_audio_seconds, p_extra_cost_micro);
  insert into public.ai_usage_events (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro, credits_exempt)
  values (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, v_units, p_latency, p_status, v_cost, r.advisor_free or v_free);
  if r.chat_id is not null then
    update public.ai_chats set units = units + v_units, turns = turns + case when r.feature = 'chat' and p_status = 'ok' then 1 else 0 end, last_at = now()
      where chat_id = r.chat_id;
  end if;
  return v_cost;
end;
$$;
