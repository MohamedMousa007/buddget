-- 0126 — Buddgy AI gateway: metadata-only chat sessions, usage events and the quota "wheel".
-- Plans and entitlements already exist (plans, user_entitlements); AI limits live under
-- plans.limits->'ai' and user_entitlements.limit_overrides->'ai'. No message content is stored.

create table if not exists public.ai_chats (
  chat_id    uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  units      numeric not null default 0,
  turns      integer not null default 0,
  closed     boolean not null default false
);
create index if not exists ai_chats_user_started_idx on public.ai_chats (user_id, started_at desc);

create table if not exists public.ai_usage_events (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  chat_id       uuid references public.ai_chats(chat_id) on delete set null,
  feature       text not null,
  model         text,
  tier          text,
  in_tokens     integer not null default 0,
  cached_tokens integer not null default 0,
  out_tokens    integer not null default 0,
  units         numeric not null default 0,
  latency_ms    integer,
  status        text not null default 'ok',
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_events_user_created_idx on public.ai_usage_events (user_id, created_at desc);

create table if not exists public.ai_reservations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  chat_id    uuid references public.ai_chats(chat_id) on delete cascade,
  feature    text not null,
  est_units  numeric not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  settled    boolean not null default false
);
create index if not exists ai_reservations_user_idx on public.ai_reservations (user_id, created_at desc);

alter table public.ai_chats enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.ai_reservations enable row level security;

create policy ai_chats_select_own on public.ai_chats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_usage_events_select_own on public.ai_usage_events
  for select to authenticated using ((select auth.uid()) = user_id);

-- Launch defaults: deliberately generous so nobody meets a limit before pricing is decided.
-- Tighten per plan by writing plans.limits->'ai' (e.g. units_5h 60000, units_24h 150000).
create or replace function public.ai_default_limits() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'chat_units_soft', 30000,
    'chat_units_hard', 60000,
    'chat_turns', 40,
    'chats_per_hour', 30,
    'chats_per_day', 100,
    'units_5h', 600000,
    'units_24h', 1500000,
    'units_7d', 6000000,
    'req_per_min', 30,
    'idle_minutes', 30,
    'disabled', '[]'::jsonb
  )
$$;

create or replace function public.ai_effective_limits(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d jsonb := public.ai_default_limits();
  merged jsonb := public.ai_default_limits();
  v_plan text;
  v_over jsonb;
  v_limits jsonb;
  layer jsonb;
  k text;
  v jsonb;
begin
  select e.plan_key, e.limit_overrides into v_plan, v_over
  from public.user_entitlements e
  where e.user_id = p_user
    and e.status not in ('canceled', 'expired', 'suspended')
    and (e.current_period_end is null or e.current_period_end > now())
  order by e.current_period_end desc nulls first
  limit 1;

  if v_plan is not null then
    select p.limits into v_limits from public.plans p where p.key = v_plan;
  end if;
  if v_limits is null then
    select p.limits into v_limits from public.plans p where p.is_default order by p.created_at limit 1;
  end if;

  -- Only known keys of the right JSON type are accepted, so a malformed plan or override
  -- can never null out a limit: anything else falls back to the default for that key.
  foreach layer in array array[v_limits -> 'ai', v_over -> 'ai'] loop
    if layer is not null and jsonb_typeof(layer) = 'object' then
      for k, v in select * from jsonb_each(layer) loop
        if d ? k and jsonb_typeof(v) = jsonb_typeof(d -> k) then
          merged := merged || jsonb_build_object(k, v);
        end if;
      end loop;
    end if;
  end loop;

  return merged;
end;
$$;

create or replace function public.ai_quota_reserve(
  p_user uuid, p_chat uuid, p_feature text, p_est numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if v_cnt >= (L ->> 'req_per_min')::numeric then
    return jsonb_build_object('allowed', false, 'layer', 'rate', 'reset_at', v_first + interval '60 seconds');
  end if;

  if v_base = 'chat' then
    if p_chat is not null then
      select * into v_chat from public.ai_chats where chat_id = p_chat and user_id = p_user;
    end if;

    if v_hop then
      -- A tool-loop hop only continues a live chat: it never opens one and never outruns the hard cap.
      if v_chat.chat_id is null
         or v_chat.closed
         or v_chat.last_at < t - interval '10 minutes'
         or v_chat.units >= (L ->> 'chat_units_hard')::numeric * 1.5 then
        return jsonb_build_object('allowed', false, 'layer', 'rate', 'reset_at', t + interval '60 seconds');
      end if;
      v_chat_id := v_chat.chat_id;
    else
      if v_chat.chat_id is null
         or v_chat.closed
         or v_chat.last_at < t - ((L ->> 'idle_minutes')::float8 * interval '1 minute') then
        v_new := true;
      elsif v_chat.turns >= (L ->> 'chat_turns')::numeric
         or v_chat.units >= (L ->> 'chat_units_hard')::numeric then
        update public.ai_chats set closed = true where chat_id = v_chat.chat_id;
        v_new := true;
        v_rolled := true;
      else
        v_chat_id := v_chat.chat_id;
        v_soft := v_chat.units >= (L ->> 'chat_units_soft')::numeric;
      end if;

      if v_new then
        select count(*), min(started_at) into v_cnt, v_first
        from public.ai_chats where user_id = p_user and started_at > t - interval '1 hour';
        if v_cnt >= (L ->> 'chats_per_hour')::numeric then
          return jsonb_build_object('allowed', false, 'layer', 'chats_hour', 'reset_at', v_first + interval '1 hour');
        end if;
        select count(*), min(started_at) into v_cnt, v_first
        from public.ai_chats where user_id = p_user and started_at > t - interval '24 hours';
        if v_cnt >= (L ->> 'chats_per_day')::numeric then
          return jsonb_build_object('allowed', false, 'layer', 'chats_day', 'reset_at', v_first + interval '24 hours');
        end if;
      end if;
    end if;
  end if;

  for w in
    select * from (values
      ('window_5h', interval '5 hours', 'units_5h'),
      ('window_24h', interval '24 hours', 'units_24h'),
      ('window_7d', interval '7 days', 'units_7d')
    ) as v(layer, span, limit_key)
  loop
    select coalesce(sum(x.units), 0), min(x.created_at) into v_used, v_first from (
      select units, created_at from public.ai_usage_events
        where user_id = p_user and created_at > t - w.span
      union all
      select est_units, created_at from public.ai_reservations
        where user_id = p_user and not settled and expires_at > t and created_at > t - w.span
    ) x;
    if v_used >= (L ->> w.limit_key)::numeric then
      return jsonb_build_object('allowed', false, 'layer', w.layer, 'reset_at', v_first + w.span);
    end if;
  end loop;

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
$$;

create or replace function public.ai_quota_settle(
  p_reservation uuid, p_user uuid, p_units numeric,
  p_in integer, p_cached integer, p_out integer,
  p_model text, p_tier text, p_latency integer, p_status text
) returns void
language plpgsql security definer set search_path = public as $$
declare r public.ai_reservations%rowtype;
begin
  select * into r from public.ai_reservations
    where id = p_reservation and user_id = p_user and not settled for update;
  if not found then return; end if;
  update public.ai_reservations set settled = true where id = p_reservation;
  insert into public.ai_usage_events
    (user_id, chat_id, feature, model, tier, in_tokens, cached_tokens, out_tokens, units, latency_ms, status)
  values
    (p_user, r.chat_id, r.feature, p_model, p_tier, p_in, p_cached, p_out, p_units, p_latency, p_status);
  if r.chat_id is not null then
    update public.ai_chats
      set units = units + p_units,
          turns = turns + case when r.feature = 'chat' then 1 else 0 end,
          last_at = now()
      where chat_id = r.chat_id;
  end if;
end;
$$;

create or replace function public.ai_quota_release(p_reservation uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.ai_reservations set settled = true where id = p_reservation and user_id = p_user;
$$;

revoke all on function public.ai_default_limits() from public, anon, authenticated;
revoke all on function public.ai_effective_limits(uuid) from public, anon, authenticated;
revoke all on function public.ai_quota_reserve(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.ai_quota_release(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ai_default_limits() to service_role;
grant execute on function public.ai_effective_limits(uuid) to service_role;
grant execute on function public.ai_quota_reserve(uuid, uuid, text, numeric) to service_role;
grant execute on function public.ai_quota_settle(uuid, uuid, numeric, integer, integer, integer, text, text, integer, text) to service_role;
grant execute on function public.ai_quota_release(uuid, uuid) to service_role;
