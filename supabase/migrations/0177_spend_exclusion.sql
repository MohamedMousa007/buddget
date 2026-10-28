-- "Not counted" money. A payment method can be left out of spending and totals (a card someone else uses), and a single
-- expense can be left out of spending (a one-off, or paid for someone who owes it back). Reporting flags only: the
-- ledger rows and account balances of the expense stay true. spend_exclusion records why, so switching a payment
-- method back on only clears what the method itself caused.
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS spend_exclusion text CHECK (spend_exclusion IN ('method','manual','for_someone')),
  ADD COLUMN IF NOT EXISTS owed_by text,
  ADD COLUMN IF NOT EXISTS owed_settled_at timestamptz;
