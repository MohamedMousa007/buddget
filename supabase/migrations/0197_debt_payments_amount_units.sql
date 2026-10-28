-- QA2 D2: debt_payments.amount is in DEBT units but was labelled with the paying currency.
-- Additive only: `amount` and `currency` keep their legacy meaning (old app builds still read them).
-- New nullable columns carry the explicit meaning; NULL = legacy row, readers fall back to amount/currency.
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS amount_in_debt_unit numeric,
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS original_currency public.currency_code,
  ADD COLUMN IF NOT EXISTS amount_in_base numeric,
  ADD COLUMN IF NOT EXISTS rate_at_entry numeric;

-- `amount` has always been stored in debt units, so this is unambiguous for every row.
UPDATE public.debt_payments
SET amount_in_debt_unit = amount
WHERE amount_in_debt_unit IS NULL;

-- original amount/currency is only knowable when the paying currency equals the debt currency
-- (no conversion happened). Cross-currency and gold rows stay NULL (legacy fallback).
UPDATE public.debt_payments p
SET original_amount = p.amount,
    original_currency = p.currency
FROM public.debts d
WHERE d.id = p.debt_id
  AND p.original_amount IS NULL
  AND d.is_gold IS NOT TRUE
  AND d.currency::text = p.currency::text;
