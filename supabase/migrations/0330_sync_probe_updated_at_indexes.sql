-- S8d: sync_changed_since probes `WHERE user_id = $1 AND updated_at > $2` on each synced table (every foreground, every reload).
-- None of the growing tables had an index for it, so the probe seq-scanned them (expenses: Seq Scan, cost 153.6 at 3.7k rows).
-- Index-only migration; safe to run again. Only the tables that grow with use: expenses, income_events, savings_transactions, receipts, debt_payments.
-- Rollback: drop index if exists idx_<table>_user_updated for each.
CREATE INDEX IF NOT EXISTS idx_expenses_user_updated ON public.expenses (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_income_events_user_updated ON public.income_events (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_user_updated ON public.savings_transactions (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_receipts_user_updated ON public.receipts (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_updated ON public.debt_payments (user_id, updated_at);
