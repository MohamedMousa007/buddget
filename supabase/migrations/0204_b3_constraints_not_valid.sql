-- 0204_b3_constraints_not_valid.sql  (QA round 2, B3/S1: Q8)
--
-- DEPLOY ORDER: RESTRICTIVE. Apply AFTER the B2 write guards (I8: no zero/negative amount reaches a ledger row from
-- any sheet, SMS or Buddgy path) are deployed and verified. Installed builds that still send a zero/negative amount
-- will have that single row rejected (23514); the sync runner (OpRunner.upsert) retries the batch row by row on 23514/23503/23505,
-- saves the good rows and reports only the failing ones; that is why the scope is the minimum
-- one: amount > 0 on the three ledger tables only.
--
-- Deliberately NOT included (owner/plan decisions):
--   * budget_categories (4 live rows with amount 0 -> a CHECK would make those lines un-editable).
--   * any date-window CHECK (3 live rows dated 2028/2030/2009; NOT VALID does not protect old rows from UPDATE, so
--     editing or deleting one of them would fail forever).
--   * debts (2 live zero-amount credit cards), savings_transactions, recurring_*.
-- NOT VALID: existing rows are never scanned/validated by this file; every INSERT and UPDATE of a row is checked.
-- It is NOT validated afterwards on purpose: VALIDATE is a separate, later decision once old builds are gone.
--
-- AUDIT BEFORE APPLY (SELECT only). Expected 0 for every column (measured 2026-10-28), the DO block re-asserts it:
--   select (select count(*) from public.expenses where amount <= 0) as expenses,
--          (select count(*) from public.income_events where amount <= 0) as income_events,
--          (select count(*) from public.debt_payments where amount <= 0) as debt_payments;
--   select conrelid::regclass, conname from pg_constraint where conname in ('expenses_amount_pos','income_events_amount_pos','debt_payments_amount_pos'); -- 0 rows before, 3 after
--   -- row counts (tiny, no lock concern): expenses 597, income_events 171, debt_payments 5.

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.expenses WHERE amount <= 0;
  IF n > 0 THEN RAISE EXCEPTION '0204: % expenses with amount <= 0; repair them first (owner approval + backup)', n; END IF;
  SELECT count(*) INTO n FROM public.income_events WHERE amount <= 0;
  IF n > 0 THEN RAISE EXCEPTION '0204: % income_events with amount <= 0; repair them first', n; END IF;
  SELECT count(*) INTO n FROM public.debt_payments WHERE amount <= 0;
  IF n > 0 THEN RAISE EXCEPTION '0204: % debt_payments with amount <= 0; repair them first', n; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_pos' AND conrelid = 'public.expenses'::regclass) THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_pos CHECK (amount > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'income_events_amount_pos' AND conrelid = 'public.income_events'::regclass) THEN
    ALTER TABLE public.income_events ADD CONSTRAINT income_events_amount_pos CHECK (amount > 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debt_payments_amount_pos' AND conrelid = 'public.debt_payments'::regclass) THEN
    ALTER TABLE public.debt_payments ADD CONSTRAINT debt_payments_amount_pos CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

-- POST-APPLY CHECKS (expect): 3 rows, convalidated = false
--   select conrelid::regclass, conname, convalidated from pg_constraint where conname in ('expenses_amount_pos','income_events_amount_pos','debt_payments_amount_pos');
-- ROLLBACK: alter table public.expenses drop constraint expenses_amount_pos; (same for the other two).
