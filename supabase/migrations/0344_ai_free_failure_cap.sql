-- Council decision 2026-11-24 (Buddgy charging): a call that shows the user nothing stays free (0337), but a failure that
-- cost us real provider money (safety block, stream cut after the model spent input or thinking tokens) is capped: once a
-- user already has 5 such free failures in the last hour, the next one is charged like a normal call.
-- Failures that cost nothing (provider error before inference, cost_usd_micro = 0) are never capped, so a provider outage
-- never bills anyone.
-- Live data on 2026-11-24: 39 'error' rows, 0 of them with any cost, so today the cap changes nothing; it bounds abuse at launch.
-- Query is bounded: user_id + created_at on ai_usage_events_user_cover_idx, one hour, LIMIT 5.
-- Same signature as 0338: no overload, grants unchanged (service_role only, 0315).
-- Rollback: re-run ai_quota_settle_core from 0338_ai_one_charge_per_turn.sql.

create or replace function public.ai_quota_settle_core(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint;
  v_fail boolean := coalesce(p_status in ('error', 'aborted_empty'), false);
  v_free boolean;
  v_units numeric;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return 0; end if;
  v_cost := public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out, p_audio_seconds, p_extra_cost_micro);
  if v_fail and v_cost > 0 and (
    select count(*) from (
      select 1 from public.ai_usage_events
      where user_id = p_user and created_at > now() - interval '1 hour'
        and credits_exempt and status in ('error', 'aborted_empty') and cost_usd_micro > 0
      limit 5) f) >= 5
  then v_fail := false; end if;
  v_free := v_fail or r.free_rerun;
  v_units := case when v_free then 0 else p_units end;
  update public.ai_reservations set settled = true where id = p_reservation;
  insert into public.ai_usage_events (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro, credits_exempt, turn_id)
  values (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, v_units, p_latency, p_status, v_cost, r.advisor_free or v_free, r.turn_id);
  if r.chat_id is not null then
    update public.ai_chats set units = units + v_units, turns = turns + case when r.feature = 'chat' and p_status = 'ok' and not r.free_rerun then 1 else 0 end, last_at = now()
      where chat_id = r.chat_id;
  end if;
  return v_cost;
end;
$$;
