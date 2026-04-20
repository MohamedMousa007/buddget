-- Part of the database audit follow-up (DB-4 in the audit report).
--
-- Add a tombstone `deleted_at timestamptz NULL` column to every
-- user-owned array table + a partial index on `(user_id) WHERE
-- deleted_at IS NULL` to keep the common "active rows for user"
-- hydrate path fast.
--
-- Why soft delete
-- ---------------
-- Today, deleting a row in the app emits a hard `DELETE` in the sync
-- layer. Two devices editing the same dataset (offline + native
-- wrapper vision) can't reconcile deletions: device A's delete
-- arrives at the server, but device B's local cache still has the
-- row until its next pull. With soft delete:
--   - deletions become regular UPDATEs, idempotent across replays
--   - the change is visible to other devices the next time they
--     select (or, eventually, via the DB-7 change_log feed)
--   - a 90-day nightly purge hard-deletes old tombstones; that
--     cron is deferred
--
-- The 15 user-owned array tables below all get the same treatment.
-- Skipped: profiles / user_settings / onboarding_state (singletons),
-- app_analytics_events (append-only log), notifications /
-- trusted_devices (intentional immediate deletes today),
-- live_market_data / api_rate_limits (infrastructure).

ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_payment_methods_live ON public.payment_methods(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.income_sources ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_income_sources_live ON public.income_sources(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_live ON public.expenses(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_live ON public.recurring_expenses(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_live ON public.subscriptions(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_debts_live ON public.debts(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_debt_payments_live ON public.debt_payments(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.recurring_debt_payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_debt_payments_live ON public.recurring_debt_payments(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.savings_accounts ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_savings_accounts_live ON public.savings_accounts(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.savings_holdings ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_savings_holdings_live ON public.savings_holdings(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.savings_transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_savings_transactions_live ON public.savings_transactions(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.recurring_savings_deposits ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_savings_deposits_live ON public.recurring_savings_deposits(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_goals_live ON public.goals(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.budget_plans ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_budget_plans_live ON public.budget_plans(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.budget_categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_budget_categories_live ON public.budget_categories(user_id) WHERE deleted_at IS NULL;

ALTER TABLE public.budget_subcategories ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
CREATE INDEX IF NOT EXISTS idx_budget_subcategories_live ON public.budget_subcategories(user_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.payment_methods.deleted_at IS
  'Tombstone timestamp set by the sync layer when the row is "deleted" in-app. Null = live row; non-null = soft-deleted and excluded from hydrate queries. A future Edge Function purges tombstones older than 90 days.';
