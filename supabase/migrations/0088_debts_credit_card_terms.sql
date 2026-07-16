-- Persist the credit-card terms that only ever existed on the client.
--
-- Debt.paymentDueDay / gracePeriodDays / minimumPaymentPercent are on the TypeScript type
-- and drive the billing cycle, the next due date and the minimum payment — but had no
-- columns and were absent from debtMapper, so they were dropped on every sync. On a second
-- device getCurrentBillingCycleExpenses bails (no paymentDueDay) and CreditCardDebtCard
-- shows its setup banner forever.
--
-- Nullable on purpose: useAddDebtSheet already defaults with `|| 55` / `|| 5`, so a NULL
-- re-defaults client-side rather than baking a magic number into the schema.
-- RLS needs no change — the debts policies are table-level on user_id (0029), and 0070/0080
-- added columns here the same way.
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS payment_due_day int
    CONSTRAINT debts_payment_due_day_range CHECK (payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS grace_period_days int,
  ADD COLUMN IF NOT EXISTS minimum_payment_percent numeric
    CONSTRAINT debts_minimum_payment_percent_range CHECK (minimum_payment_percent IS NULL OR minimum_payment_percent BETWEEN 0 AND 100);
