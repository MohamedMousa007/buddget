-- Accounts refactor 2/5: ledger time + account links. All nullable and additive; no backfill (readers fall back to the date column).
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS to_payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.income_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.savings_accounts
  ADD COLUMN IF NOT EXISTS held_in_payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS balance_after numeric(14,2);

CREATE INDEX IF NOT EXISTS idx_expenses_to_pm ON public.expenses (to_payment_method_id) WHERE to_payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_savings_tx_pm ON public.savings_transactions (payment_method_id) WHERE payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_savings_accounts_held_in ON public.savings_accounts (held_in_payment_method_id) WHERE held_in_payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_parse_log_pm ON public.sms_parse_log (payment_method_id) WHERE payment_method_id IS NOT NULL;

-- Guard needs expenses.to_payment_method_id, so the trigger is created here (after the column exists).
DROP TRIGGER IF EXISTS b_payment_methods_guard ON public.payment_methods;
CREATE TRIGGER b_payment_methods_guard BEFORE INSERT OR UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.payment_methods_guard();
