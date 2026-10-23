-- Today's AI spend (UTC day) next to the owner-set daily cap. No cap row = no guardrail.
create or replace function public.ai_spend_today()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'costMicro', coalesce((select sum(cost_usd_micro) from ai_usage_events where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'), 0),
    'capUsd', (select (value ->> 'dailyCapUsd')::numeric from platform_settings where key = 'ai_spend_guard')
  )
$$;
revoke all on function public.ai_spend_today() from public, anon, authenticated;
grant execute on function public.ai_spend_today() to service_role;
