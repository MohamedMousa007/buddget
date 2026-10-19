-- Rate limiter for the admin portal's sign-in endpoints. The shared api_rate_hit aligns its window with
-- `extract(epoch ...)::int`, which ROUNDS: depending on the fractional second a call lands in it picks one of two
-- adjacent buckets, so a limit of N can admit up to 2N hits per window. Brute-force protection must not depend on that,
-- so the portal gets its own limiter with a floored (aligned) window. Service-role only. Expired buckets are pruned by
-- api_rate_hit's own cleanup, which shares the table.
CREATE OR REPLACE FUNCTION public.admin_rate_hit(p_key text, p_window_seconds integer, p_max_hits integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.api_rate_limits(key, window_start, hits) values (p_key, v_bucket, 1)
  on conflict (key, window_start) do update set hits = api_rate_limits.hits + 1 returning hits into v_hits;
  return v_hits <= p_max_hits;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rate_hit(text, integer, integer) TO service_role;
