-- Persist the purchase -> debt link.
--
-- `Expense.linkedDebtId` existed on the TypeScript type but had no column and was absent
-- from expenseMapper, so it was dropped on every sync. Only `linkedDebtPaymentId` (the
-- SETTLEMENT link) round-tripped — nothing recorded the PURCHASE that created a debt.
--
-- Net worth needs it. A BNPL checkout writes the full purchase as spend AND creates an
-- installment debt for the full amount, so without a link between the two, cash flow and
-- the balance sheet both count it: 600 spent becomes -1200 of net worth.
--
-- Why not just exclude every expense on a BNPL payment method, as is done for a credit
-- card: `computeCreditCardOutstanding` sums all card expenses, so a card's debt genuinely
-- carries every one of them. An installment debt does NOT — its balance is the purchase
-- amount captured at checkout. A BNPL purchase that was NOT split into a plan creates no
-- debt at all, so excluding it by payment method would erase it from net worth entirely.
-- The link is the only honest discriminator.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS linked_debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_linked_debt
  ON public.expenses (linked_debt_id)
  WHERE linked_debt_id IS NOT NULL;

COMMENT ON COLUMN public.expenses.linked_debt_id IS
  'The debt this expense CREATED (a BNPL checkout). Distinct from linked_debt_payment_id, which links a settlement.';
