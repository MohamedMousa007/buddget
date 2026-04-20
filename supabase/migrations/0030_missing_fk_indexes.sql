-- Part of the database audit follow-up (DB-2 in the audit report).
--
-- Seven foreign keys have no covering index, so every JOIN from these
-- FKs + every cascade-delete on the parent row does a sequential scan.
-- The hottest column is `payment_method_id` across 5 tables — it's
-- read on virtually every dashboard render.
--
-- Nullable FKs use a partial index (`WHERE ... IS NOT NULL`) so the
-- index stays small; only rows that actually point at something
-- contribute.

CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_method
  ON public.debt_payments(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_sources_payment_method
  ON public.income_sources(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_debt_payments_payment_method
  ON public.recurring_debt_payments(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_payment_method
  ON public.recurring_expenses(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method
  ON public.subscriptions(payment_method_id)
  WHERE payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debts_linked_credit_card_debt
  ON public.debts(linked_credit_card_debt_id)
  WHERE linked_credit_card_debt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_linked_debt_payment
  ON public.expenses(linked_debt_payment_id)
  WHERE linked_debt_payment_id IS NOT NULL;
