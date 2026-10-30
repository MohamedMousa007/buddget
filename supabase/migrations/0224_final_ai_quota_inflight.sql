-- Audit first (read-only):
--   SELECT feature, count(*) FROM public.ai_reservations WHERE NOT settled AND expires_at > now() GROUP BY 1;
-- ai_quota_reserve stays untouched. ai_quota_reserve_v2 = live body, except the receipt (30d) and voice (24h) caps
-- also count unsettled, unexpired reservations of that feature (I16), like the chat-per-day cap already does.

CREATE OR REPLACE FUNCTION public.ai_quota_reserve_v2(p_user uuid, p_chat uuid, p_feature text, p_est numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if p_feature = 'chat' and (L ->> 'ai_chat_per_day') is not null then
    select count(*), min(x.created_at) into v_cnt, v_first from (
      select created_at from public.ai_usage_events where user_id = p_user and feature = 'chat' and created_at > t - interval '24 hours'
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
         or v_chat.units >= (L ->> 'ai_chat_units_hard')::numeric * 1.5 then
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

  for w in
    select * from (values
      ('window_5h', interval '5 hours', 'ai_units_5h'),
      ('window_24h', interval '24 hours', 'ai_units_24h'),
      ('window_7d', interval '7 days', 'ai_units_7d')
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
$function$;

REVOKE ALL ON FUNCTION public.ai_quota_reserve_v2(uuid, uuid, text, numeric) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_reserve_v2(uuid, uuid, text, numeric) TO service_role;

DO $$ BEGIN
  IF to_regprocedure('public.ai_quota_reserve_v2(uuid,uuid,text,numeric)') IS NULL THEN RAISE EXCEPTION 'ai_quota_reserve_v2 missing'; END IF;
  IF to_regprocedure('public.ai_quota_reserve(uuid,uuid,text,numeric)') IS NULL THEN RAISE EXCEPTION 'ai_quota_reserve was dropped'; END IF;
END $$;
