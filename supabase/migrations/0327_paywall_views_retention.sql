-- QA-52: paywall_views had no purge (project rule: no event table without one). db_retention
-- (from 0301) now also drops views older than 400 days, the same horizon as app_analytics_daily.
-- paywall_views_day_idx (viewed_at) serves both the guard and the delete. Grants unchanged
-- (CREATE OR REPLACE keeps them; 0315 left this function service_role only).

create or replace function public.db_retention()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE n integer := 0; m integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_analytics_daily WHERE day < current_date - 400 LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM public.sms_parse_log WHERE status = 'rejected' AND received_at < now() - interval '365 days' LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM public.paywall_views WHERE viewed_at < now() - interval '400 days' LIMIT 1) THEN
    RETURN 0;
  END IF;
  DELETE FROM public.app_analytics_daily WHERE day < current_date - 400;
  GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  DELETE FROM public.paywall_views WHERE viewed_at < now() - interval '400 days';
  GET DIAGNOSTICS m = ROW_COUNT; n := n + m;
  WITH d AS (
    DELETE FROM public.sms_parse_log l
     WHERE l.id IN (SELECT id FROM public.sms_parse_log
                     WHERE status = 'rejected' AND received_at < now() - interval '365 days'
                       AND expense_id IS NULL AND income_id IS NULL AND debt_payment_id IS NULL AND savings_transaction_id IS NULL
                       AND paired_log_id IS NULL AND discard_requested_at IS NULL
                     LIMIT 2000)
       AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.sms_log_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM public.income_events i WHERE i.sms_log_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM public.sms_parse_log o WHERE o.paired_log_id = l.id)
    RETURNING 1)
  SELECT count(*) INTO m FROM d; n := n + m;
  RETURN n;
END $function$;
