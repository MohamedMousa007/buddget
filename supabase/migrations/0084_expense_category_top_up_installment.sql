-- Add the two expense_category values that exist in TypeScript but never reached the DB enum.
-- Without them, expenseMapper.toDbCategory coerced 'Top up' and 'Installment' to 'Other' — a
-- SPEND category — so every BNPL installment settlement would have double-counted the purchase
-- (once at checkout, once as the settlement) after a sync round-trip.
--
-- ALTER TYPE ADD VALUE cannot be used in the same transaction it is added, so this migration
-- ONLY adds the values; the mapper change that emits them ships after this lands (see 0068).
-- Additive and backward-compatible: older clients never emit these values, so they are unaffected.
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Top up';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'Installment';
