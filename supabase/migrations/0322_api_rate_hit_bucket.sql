-- QA-17: api_rate_hit rounded the epoch (::int), so calls in the second half of a
-- second landed in a bucket one second earlier: two counters per window, about 2x
-- the configured rate. Use the floor formula admin_rate_hit already uses (0126).

create or replace function public.api_rate_hit(p_key text, p_window_seconds integer, p_max_hits integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.api_rate_limits(key, window_start, hits)
  values (p_key, v_bucket, 1)
  on conflict (key, window_start) do update set hits = api_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max_hits;
end;
$function$;

revoke all on function public.api_rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.api_rate_hit(text, integer, integer) to service_role;

do $$
declare
  t0 numeric := 1700000000.2;
  t1 numeric := 1700000000.7;
begin
  assert to_timestamp(floor(t0 / 60) * 60) = to_timestamp(floor(t1 / 60) * 60), 'bucket differs within one second';
  assert position('::int, p_window_seconds' in pg_get_functiondef('public.api_rate_hit(text,integer,integer)'::regprocedure)) = 0,
    'api_rate_hit still rounds the epoch';
end $$;
