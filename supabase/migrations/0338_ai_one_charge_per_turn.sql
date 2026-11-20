-- BDG-011 slice 2: one charge per user message.
-- A client that sends a turn id (p_turn) groups every model call of one user message into a turn:
--   * Tool steps (a call that ends asking the phone for data, p_provisional) are provisional. Their cost is logged
--     and counted as today, but Sparks are charged once, when the turn closes, on the summed cost (today each step
--     costs at least one Spark of its own).
--   * The final call decides. A turn that ends with nothing shown ('error' or 'aborted_empty', and no earlier step
--     carried text or a proposal) is free in full: its tool steps are made exempt and their units come off the chat.
--   * Shown = text streamed, or a proposal or navigation (p_visible, sent by the server from the tool kinds). Whether
--     the user later applies a proposal happens on the phone, out of the server's sight; a proposal counts as shown.
--   * Retry reuses the turn id. Retrying a turn that was charged gets one free re-run: no credit check, no Sparks,
--     no units, not counted as a chat turn. A third attempt is an ordinary paid one. The per-minute rate limit and
--     the unit safety windows still apply to a re-run.
--   * A turn left open (the phone stopped between steps) is closed as charged on the user's next new message: only a
--     failure the server itself saw makes a turn free.
--   * Hops inherit the turn's funding (credits or Sparks) from its first call, so one turn never splits across both.
-- A request without a turn id (the server already deployed, installed builds) keeps the per-request rule of 0337.
-- Day cap note: ai_chat_per_day is null on every plan today, so a re-run's 'ok' row counts toward no day cap.
-- ponytail: an open turn the user never follows up stays open with its Sparks uncharged; its credits are already
-- counted. Upgrade path: close turns older than an hour in the same reserve sweep.
-- Signatures: ai_quota_reserve_v2 gains p_turn, ai_quota_settle gains p_provisional and p_visible, both with
-- defaults, old signatures dropped in this migration (no overloads), EXECUTE for service_role only (0315).
-- Rollback: re-run ai_quota_reserve_v2 from 0306, ai_quota_settle from 0306, ai_quota_settle_core from 0337, after
-- dropping the new signatures; the new columns and ai_turns can stay.

alter table public.ai_reservations add column if not exists turn_id uuid, add column if not exists free_rerun boolean not null default false;
alter table public.ai_usage_events add column if not exists turn_id uuid;
create index if not exists ai_usage_events_turn_idx on public.ai_usage_events (user_id, turn_id) where turn_id is not null;
create index if not exists ai_reservations_turn_idx on public.ai_reservations (user_id, turn_id) where turn_id is not null;

create table if not exists public.ai_turns (
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid not null,
  chat_id uuid,
  state text not null default 'open' check (state in ('open', 'charged', 'free')),
  use_sparks boolean not null default false,
  spark_cost_micro bigint not null default 0,
  visible boolean not null default false,
  reruns integer not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  primary key (user_id, turn_id)
);
create index if not exists ai_turns_open_idx on public.ai_turns (user_id) where state = 'open';
alter table public.ai_turns enable row level security;
revoke all on public.ai_turns from anon, authenticated;

-- Closes an open turn as charged: Sparks once, on what its calls cost.
create or replace function public.ai_turn_close_charged(p_user uuid, p_turn uuid, p_reservation uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare t public.ai_turns%rowtype;
begin
  update public.ai_turns set state = 'charged', closed_at = now()
    where user_id = p_user and turn_id = p_turn and state = 'open'
    returning * into t;
  if found and t.use_sparks and t.spark_cost_micro > 0 then
    perform public.spark_charge(p_user, greatest(1, ceil(t.spark_cost_micro / 1000.0)::integer), p_reservation, 'chat');
  end if;
end;
$$;
revoke all on function public.ai_turn_close_charged(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ai_turn_close_charged(uuid, uuid, uuid) to service_role;

create or replace function public.ai_quota_settle_core(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint;
  v_free boolean := coalesce(p_status in ('error', 'aborted_empty'), false);
  v_units numeric;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return 0; end if;
  v_free := v_free or r.free_rerun;
  v_units := case when v_free then 0 else p_units end;
  update public.ai_reservations set settled = true where id = p_reservation;
  v_cost := public.ai_cost_usd_micro(p_model, p_in, p_cached, p_out, p_audio_seconds, p_extra_cost_micro);
  insert into public.ai_usage_events (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status, cost_usd_micro, credits_exempt, turn_id)
  values (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, v_units, p_latency, p_status, v_cost, r.advisor_free or v_free, r.turn_id);
  if r.chat_id is not null then
    update public.ai_chats set units = units + v_units, turns = turns + case when r.feature = 'chat' and p_status = 'ok' and not r.free_rerun then 1 else 0 end, last_at = now()
      where chat_id = r.chat_id;
  end if;
  return v_cost;
end;
$$;

drop function if exists public.ai_quota_reserve_v2(uuid, uuid, text, numeric, boolean);
create function public.ai_quota_reserve_v2(p_user uuid, p_chat uuid, p_feature text, p_est numeric, p_advisor_free boolean default false, p_turn uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  L jsonb; w jsonb; r jsonb; t timestamptz := now();
  v_hop boolean := p_feature = 'chat_hop';
  v_credit boolean;
  s_lim numeric; w_lim numeric; s_over boolean := false; w_over boolean := false;
  v_use_sparks boolean := false;
  v_reset timestamptz;
  tr public.ai_turns%rowtype;
  v_turn uuid;
  v_rerun boolean := false;
  o record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if p_turn is not null and p_feature in ('chat', 'chat_hop') then
    select * into tr from public.ai_turns where user_id = p_user and turn_id = p_turn for update;
    if v_hop then
      -- A hop belongs to an open turn of this user; any other hop is billed per request, as before.
      if tr.turn_id is not null and tr.state = 'open' then v_turn := p_turn; v_use_sparks := tr.use_sparks; end if;
    else
      -- A new message closes this user's other open turns as charged and forgets closed ones after two days.
      for o in select turn_id from public.ai_turns where user_id = p_user and state = 'open' and turn_id <> p_turn limit 20 loop
        perform public.ai_turn_close_charged(p_user, o.turn_id, null);
      end loop;
      delete from public.ai_turns where user_id = p_user and state <> 'open' and created_at < t - interval '2 days';
      v_turn := p_turn;
      -- The same message again (Retry). An attempt left open is charged as it stands, then the retry is the free re-run.
      -- The turn row itself is written only once the call is allowed, so a refused retry keeps its free re-run.
      if tr.turn_id is not null and tr.state = 'open' then
        perform public.ai_turn_close_charged(p_user, p_turn, null);
        tr.state := 'charged';
      end if;
      v_rerun := tr.turn_id is not null and tr.state = 'charged' and tr.reruns = 0;
    end if;
  end if;

  L := public.ai_effective_limits(p_user);
  v_credit := p_feature <> 'sms' and not coalesce(p_advisor_free, false) and not v_rerun and not (v_hop and v_turn is not null) and public.billing_enabled();
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
    end if;
  end if;

  r := public.ai_quota_reserve_v2_core(p_user, p_chat, p_feature, p_est);
  if not (r ->> 'allowed')::boolean then return r; end if;

  update public.ai_reservations
    set use_sparks = v_use_sparks, sparks = case when v_use_sparks then 1 else 0 end, advisor_free = coalesce(p_advisor_free, false),
        turn_id = v_turn, free_rerun = v_rerun
    where id = (r ->> 'reservation_id')::uuid;
  if v_turn is not null and not v_hop then
    if v_rerun then
      update public.ai_turns set reruns = reruns + 1 where user_id = p_user and turn_id = v_turn;
    else
      -- A first attempt, or a paid one after a free attempt or a used re-run: the turn starts over.
      insert into public.ai_turns (user_id, turn_id, chat_id, use_sparks) values (p_user, v_turn, (r ->> 'chat_id')::uuid, v_use_sparks)
      on conflict (user_id, turn_id) do update
        set state = 'open', closed_at = null, spark_cost_micro = 0, visible = false, chat_id = excluded.chat_id, use_sparks = excluded.use_sparks;
    end if;
  end if;
  if v_credit and not v_use_sparks then
    insert into public.ai_credit_sessions (user_id, session_start) values (p_user, t)
    on conflict (user_id) do update set session_start = excluded.session_start
      where public.ai_credit_sessions.session_start + interval '5 hours' <= t;
  end if;
  return r;
end;
$$;
revoke all on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric, boolean, uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_reserve_v2(uuid, uuid, text, numeric, boolean, uuid) to service_role;

drop function if exists public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint);
create function public.ai_quota_settle(
  p_reservation uuid, p_user uuid, p_units numeric, p_in integer, p_cached integer, p_out integer, p_model text, p_tier text, p_latency integer, p_status text,
  p_audio_seconds integer default 0, p_extra_cost_micro bigint default 0, p_provisional boolean default false, p_visible boolean default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_reservations%rowtype; v_cost bigint; tr public.ai_turns%rowtype;
  v_free boolean := coalesce(p_status in ('error', 'aborted_empty'), false);
  v_freed numeric;
begin
  select * into r from public.ai_reservations where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return; end if;
  v_cost := public.ai_quota_settle_core(p_reservation, p_user, p_units, p_in, p_cached, p_out, p_model, p_tier, p_latency, p_status, p_audio_seconds, p_extra_cost_micro);

  if r.turn_id is null then
    if r.use_sparks and (p_status = 'ok' or (p_status = 'aborted' and coalesce(p_out, 0) > 0)) then
      perform public.spark_charge(p_user, greatest(1, ceil(v_cost / 1000.0)::integer), p_reservation, r.feature);
    end if;
  elsif not r.free_rerun then
    update public.ai_turns
      set spark_cost_micro = spark_cost_micro + case when v_free then 0 else v_cost end,
          visible = visible or (not v_free and (not coalesce(p_provisional, false) or coalesce(p_visible, false)))
      where user_id = p_user and turn_id = r.turn_id and state = 'open'
      returning * into tr;
    if found then
      if v_free and not tr.visible then
        -- Nothing was shown in the whole turn: its tool steps are free too.
        with old as (
          select id, units from public.ai_usage_events
          where user_id = p_user and turn_id = r.turn_id and not credits_exempt for update
        ), upd as (
          update public.ai_usage_events e set credits_exempt = true, units = 0 from old where e.id = old.id
        )
        select coalesce(sum(units), 0) into v_freed from old;
        if r.chat_id is not null and v_freed > 0 then
          update public.ai_chats set units = greatest(0, units - v_freed) where chat_id = r.chat_id;
        end if;
        update public.ai_turns set state = 'free', closed_at = now() where user_id = p_user and turn_id = r.turn_id;
      elsif v_free or p_status = 'aborted' or not coalesce(p_provisional, false) then
        perform public.ai_turn_close_charged(p_user, r.turn_id, p_reservation);
      end if;
    end if;
  end if;

  if r.advisor_free and r.feature = 'chat' and p_status = 'ok' and not r.free_rerun then
    insert into public.advisor_free_uses (user_id) values (p_user);
  end if;
end;
$$;
revoke all on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint, boolean, boolean) from public, anon, authenticated;
grant execute on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text, integer, bigint, boolean, boolean) to service_role;
