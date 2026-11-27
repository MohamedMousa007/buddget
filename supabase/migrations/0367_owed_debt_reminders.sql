-- 0367_owed_debt_reminders.sql
-- PURPOSE
--   The hourly notification run (/api/cron/notifications) now also reminds about debts the user owes that have a
--   "pay back by" date (debts.goal->>'targetDate') and no payment schedule: the day before, the day itself, then on
--   overdue days 1, 3, 7, 14, 21, 28 (same rhythm as scheduled payments). A user whose only alertable item is such a debt
--   must be a candidate, so notification_candidate_users() gains that set. Read-only change; no rows touched.
--   Query: idx_debts_live (user_id) WHERE deleted_at IS NULL serves it; EXPLAIN on live (2026-11-28): seq scan on a
--   table of ~40 rows (cost 2.88), the planner switches to the partial index as the table grows.
-- ROLLBACK: re-run supabase/migrations/0147_notification_candidates.sql.
CREATE OR REPLACE FUNCTION public.notification_candidate_users() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(array_agg(u), '{}'::uuid[]) FROM (
    SELECT user_id AS u FROM recurring_debt_payments WHERE is_active AND deleted_at IS NULL
    UNION SELECT user_id FROM subscriptions WHERE deleted_at IS NULL AND status IN ('active', 'trial')
    UNION SELECT user_id FROM goals WHERE deleted_at IS NULL AND status = 'active' AND funding_mode <> 'manual'
    UNION SELECT user_id FROM debts WHERE deleted_at IS NULL AND status = 'active' AND direction = 'i_owe' AND goal ? 'targetDate'
  ) x;
$$;
REVOKE ALL ON FUNCTION public.notification_candidate_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_candidate_users() TO service_role;
