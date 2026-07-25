-- Persist savings-transaction provenance that only ever lived on the client.
--
-- SavingsTransaction.source ('recurring_savings', 'carry', …) and isAutoSave were on the
-- TypeScript type but had no columns, so savingsTransactionToRow silently dropped them and
-- every reload from the server lost why a row existed. transfer_group_id links the two legs
-- of a pocket-to-pocket transfer so they can be rendered as one movement (and neither leg is
-- mistaken for an external deposit/withdrawal).
--
-- All nullable/defaulted; existing rows are unaffected. RLS unchanged — policies are
-- table-level on user_id.
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS is_auto_save boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_group_id uuid;

COMMENT ON COLUMN public.savings_transactions.source IS
  'Origin marker: recurring_savings, carry (month-end sweep), transfer, etc. Null for a plain user deposit/withdrawal.';
COMMENT ON COLUMN public.savings_transactions.transfer_group_id IS
  'Shared id for the two legs of a pocket-to-pocket transfer; both legs carry the same value.';
