-- Distinguish savings movements that are REAL CASH FLOW from those that are not.
--
-- netWorth = savings + investments + monthlyFlow − debt. A deposit raises the account
-- balance but `depositToSavings` creates no expense, so the income never left
-- monthlyFlow: depositing 300 raised net worth by 300 out of nothing. The fix subtracts
-- this month's deposits from the flow — but only the ones that are actually cash:
--
--   * a real deposit/withdrawal  -> cash moved            -> is_cash_flow = true
--   * an account opening balance -> declaring what exists -> is_cash_flow = false
--     (subtracting it would zero out a pre-existing 50k account)
--   * a balance correction       -> a revaluation, e.g. investment gains
--                                -> is_cash_flow = false
--     (subtracting it would cancel the gain)
--
-- Why a boolean and not the `savings_transaction_kind` enum's 'correct' value: a
-- correction can be UP or DOWN, and the enum has no direction. `kind` already carries
-- deposit/withdrawal for the sign, so cash-flow-ness has to be its own axis. This also
-- leaves every existing `kind` consumer untouched.
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS is_cash_flow boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.savings_transactions.is_cash_flow IS
  'False for opening balances and balance corrections/revaluations, which move the balance without moving cash. Only true rows are netted out of monthlyFlow.';
