-- A debt payment funded by a savings-pocket withdrawal is a balance-sheet move
-- (pocket → debt), not monthly cash outflow. calculateCashOutflow() skips these so
-- net worth stays neutral instead of dropping twice (once for the pocket, once for
-- the deferred-debt payoff). Applied live via MCP as 0104_debt_payments_funded_from_savings.
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS funded_from_savings boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.debt_payments.funded_from_savings IS
  'True when the payment was funded by a savings-pocket withdrawal (balance-sheet move); excluded from monthly cash outflow so net worth stays neutral.';
