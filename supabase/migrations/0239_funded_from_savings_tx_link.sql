-- 0239_funded_from_savings_tx_link.sql  (QA round 5, WLT9 + WLT1)
--
-- A debt payment (or an expense) funded from a savings pocket is written next to the pocket's withdrawal transaction
-- with no link between them, so deleting the payment reopened the debt but left the money out of the pocket (WLT9).
-- These nullable columns hold the withdrawal's savings_transactions.id so both can be reversed together. No foreign
-- key: savings rows are soft-deleted and the link is advisory (a missing row means there is nothing to return).
-- Additive; legacy rows stay NULL and keep the old behaviour (the delete dialog warns).
--
-- BEFORE (SELECT): select count(*) filter (where funded_from_savings), count(*) from public.debt_payments;  -- 0 / 5
-- ROLLBACK: alter table public.debt_payments drop column funded_from_savings_tx_id;
--           alter table public.expenses drop column funded_from_savings_tx_id;
ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS funded_from_savings_tx_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS funded_from_savings_tx_id uuid;
