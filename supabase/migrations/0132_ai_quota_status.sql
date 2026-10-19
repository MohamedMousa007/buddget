-- What the chat's usage wheel shows: the live chat, the rolling windows and today's chat count, with the same limits the gate enforces.
create or replace function public.ai_quota_status(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  L jsonb := public.ai_effective_limits(p_user);
  t timestamptz := now();
  c public.ai_chats%rowtype;
  r record;
  v_used numeric;
  v_first timestamptz;
  w jsonb := '{}'::jsonb;
  v_chat jsonb := null;
  v_cnt integer;
  v_cfirst timestamptz;
begin
  select * into c from public.ai_chats
  where user_id = p_user and not closed
    and last_at > t - ((L ->> 'ai_idle_minutes')::float8 * interval '1 minute')
  order by last_at desc limit 1;
  if c.chat_id is not null then
    v_chat := jsonb_build_object('units', c.units, 'hard', L -> 'ai_chat_units_hard', 'turns', c.turns, 'max_turns', L -> 'ai_chat_turns');
  end if;

  for r in select * from (values
    ('h5', interval '5 hours', 'ai_units_5h'),
    ('d1', interval '24 hours', 'ai_units_24h'),
    ('d7', interval '7 days', 'ai_units_7d')
  ) as v(k, span, lim) loop
    select coalesce(sum(units), 0), min(created_at) into v_used, v_first
    from public.ai_usage_events where user_id = p_user and created_at > t - r.span;
    w := w || jsonb_build_object(r.k, jsonb_build_object(
      'used', v_used, 'limit', L -> r.lim,
      'reset_at', case when v_first is null then null else v_first + r.span end));
  end loop;

  select count(*), min(started_at) into v_cnt, v_cfirst from public.ai_chats where user_id = p_user and started_at > t - interval '24 hours';

  return jsonb_build_object(
    'chat', v_chat,
    'windows', w,
    'chats_today', jsonb_build_object('used', v_cnt, 'limit', L -> 'ai_chats_per_day', 'reset_at', case when v_cfirst is null then null else v_cfirst + interval '24 hours' end)
  );
end;
$$;
revoke all on function public.ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid) to service_role;
