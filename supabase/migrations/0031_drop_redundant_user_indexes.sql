-- Part of the database audit follow-up (DB-3 in the audit report).
--
-- These single-column indexes on `user_id` are shadowed by composite
-- indexes already present, so Postgres never picks them. Dropping
-- them reduces write amplification on every INSERT/UPDATE of the
-- parent tables and reclaims some disk.
--
-- Shadowing map (the "covered by" column uses leftmost-prefix):
--   idx_income_sources_user        → idx_income_sources_user_created
--   idx_debts_user                 → idx_debts_user_type
--   idx_goals_user                 → idx_goals_user_status
--   idx_subscriptions_user         → idx_subscriptions_user_status
--   idx_notifications_user         → idx_notifications_user_unread
--
-- `idx_subscriptions_next_billing` is a partial index for a cron-like
-- "due today" query that the app doesn't run yet. Advisor flagged it
-- as unused. Dropping; trivially re-addable if/when we wire that cron.

DROP INDEX IF EXISTS public.idx_income_sources_user;
DROP INDEX IF EXISTS public.idx_debts_user;
DROP INDEX IF EXISTS public.idx_goals_user;
DROP INDEX IF EXISTS public.idx_subscriptions_user;
DROP INDEX IF EXISTS public.idx_notifications_user;
DROP INDEX IF EXISTS public.idx_subscriptions_next_billing;
