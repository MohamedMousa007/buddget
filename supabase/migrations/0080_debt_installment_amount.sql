-- BNPL installment tracking (Phase 3b): persist the per-installment amount.
-- `installmentAmount` was local-only (dropped on sync); a BNPL/installment plan
-- needs it to drive the schedule + reminder template across devices.
-- Applied to remote 2026-07-11.
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installment_amount numeric;
