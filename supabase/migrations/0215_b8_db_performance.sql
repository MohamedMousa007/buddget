-- 0215 B8 DB performance: F8, F9, F11, F13, Q12. NOT APPLIED. Idempotent. Separate from 0216 (gate) for easy revert.
-- Live audit (project ydihurtbcnoflhormgzi, 2026-10-28), all read-only:
--   rows: sms_parse_log 877 (1.8 MB), expenses 602 (472 kB), app_analytics_daily 517, income_events 171, app_analytics_events 0.
--   select tablename,indexname from pg_indexes where schemaname='public' and indexdef ~* '\(user_id, id\)';  -> none
--   select * from pg_publication_tables where pubname='supabase_realtime';  -> sms_parse_log (only public table)
--   select jobid,jobname,schedule from cron.job;  -> admin-metrics '*/15 * * * *', no api_rate_limits cleanup job
--   live api_rate_hit still deletes expired rows on ~2% of hits (0206); live analytics_touch is already capped (O10) and
--   the app_analytics_events policy is already count-free, table UNLOGGED + BRIN. Those are left untouched.
--   sms_heal_stuck already uses partial index sms_parse_log_processing_idx (status='processing'); left untouched.
-- Rollback: drop the two indexes; alter publication supabase_realtime add table public.sms_parse_log;
--   cron.alter_job back to '*/15 * * * *'; cron.unschedule('api-rate-cleanup'); restore api_rate_hit from 0206.

-- F8: keyset paging (src/lib/supabase/remote/sync.ts fetchLive: user_id = ? and deleted_at is null order by id, id > last).
-- Tables are tiny, so a plain CREATE INDEX is a sub-second lock; CONCURRENTLY cannot run inside a migration transaction.
CREATE INDEX IF NOT EXISTS idx_expenses_live_user_id ON public.expenses (user_id, id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_income_events_live_user_id ON public.income_events (user_id, id) WHERE deleted_at IS NULL;

-- F9: nothing subscribes to postgres_changes (grep of src/ and scripts/: only a private broadcast channel `user:<id>` in AppShell).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sms_parse_log') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sms_parse_log;
  END IF;
END $$;

-- F11: admin_refresh_metrics runs 9 admin aggregates (mean 500 ms, max 5.6 s) every 15 min; hourly cuts that load 4x.
DO $$
DECLARE j bigint;
BEGIN
  SELECT jobid INTO j FROM cron.job WHERE jobname = 'admin-metrics';
  IF j IS NOT NULL THEN PERFORM cron.alter_job(j, schedule => '7 * * * *'); END IF;
END $$;

-- Q12 / F13: the expired-bucket delete leaves the request path (it ran on ~2% of hits, inside analytics_touch / sign-in limiters).
-- Same signature, body is the live 0206 body minus the random delete.
CREATE OR REPLACE FUNCTION public.api_rate_hit(p_key text, p_window_seconds integer, p_max_hits integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bucket timestamptz := date_trunc('second', now()) - make_interval(secs => mod(extract(epoch from now())::int, p_window_seconds));
  v_hits int;
begin
  insert into public.api_rate_limits(key, window_start, hits)
  values (p_key, v_bucket, 1)
  on conflict (key, window_start) do update set hits = api_rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max_hits;
end;
$function$;

SELECT cron.schedule('api-rate-cleanup', '*/10 * * * *',
  $$DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 hour'$$);

-- Assertions
DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_expenses_live_user_id'), 'F8 expenses index missing';
  ASSERT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_income_events_live_user_id'), 'F8 income index missing';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sms_parse_log'), 'F9 still published';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-metrics' AND schedule = '7 * * * *'), 'F11 schedule';
  ASSERT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'api-rate-cleanup'), 'Q12 cron missing';
  ASSERT position('delete' in lower(pg_get_functiondef('public.api_rate_hit(text,integer,integer)'::regprocedure))) = 0, 'Q12 api_rate_hit still deletes';
END $$;
