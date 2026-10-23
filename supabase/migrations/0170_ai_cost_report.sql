create or replace function public.admin_ai_cost_daily(p_days integer default 30)
returns table(day date, model text, feature text, calls bigint, in_tokens bigint, out_tokens bigint, cost_usd_micro bigint, active_users bigint)
language sql stable security definer set search_path to 'public' as $$
  select (created_at at time zone 'UTC')::date, model, feature, count(*), sum(in_tokens)::bigint, sum(out_tokens)::bigint,
         coalesce(sum(cost_usd_micro), 0)::bigint, count(distinct user_id)
  from ai_usage_events
  where created_at >= now() - make_interval(days => least(greatest(p_days, 1), 90))
  group by 1, 2, 3 order by 1 desc, 7 desc
$$;
revoke all on function public.admin_ai_cost_daily(integer) from public, anon, authenticated;
grant execute on function public.admin_ai_cost_daily(integer) to service_role;
update admin_roles set permissions = array_append(permissions, 'ai.cost.view')
  where key in ('admin','finance','engineer','data_ai') and not ('ai.cost.view' = any(permissions));
