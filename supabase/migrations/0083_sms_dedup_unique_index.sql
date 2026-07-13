-- BUD-63: sms_parse_log_hash_unique_idx was never applied to production.
-- Two shortcuts matching the same SMS body both INSERT log rows successfully
-- and both create expenses. Fix: deduplicate existing rows, then create the
-- unique partial index so concurrent inserts hit 23505 and the route handles it.

-- Step 1: Mark all but the FIRST log row per (user_id, sms_hash) group.
-- Keep the one with the earliest received_at (= arrived first); break ties by id.
WITH keeper AS (
  SELECT DISTINCT ON (user_id, sms_hash) id
  FROM public.sms_parse_log
  WHERE sms_hash IS NOT NULL AND is_duplicate = false
  ORDER BY user_id, sms_hash, received_at ASC, id ASC
),
extras AS (
  SELECT l.id, l.expense_id, l.income_id
  FROM public.sms_parse_log l
  WHERE l.sms_hash IS NOT NULL
    AND l.is_duplicate = false
    AND l.id NOT IN (SELECT id FROM keeper)
),
del_expenses AS (
  DELETE FROM public.expenses
  WHERE id IN (SELECT expense_id FROM extras WHERE expense_id IS NOT NULL)
  RETURNING id
),
del_income AS (
  DELETE FROM public.income_events
  WHERE id IN (SELECT income_id FROM extras WHERE income_id IS NOT NULL)
  RETURNING id
)
UPDATE public.sms_parse_log l
SET is_duplicate  = true,
    failure_code  = 'duplicate',
    expense_id    = NULL,
    income_id     = NULL,
    debt_payment_id = NULL
FROM extras e
WHERE l.id = e.id;

-- Step 2: Create the unique partial index that was missing from production.
-- This blocks concurrent inserts of the same (user_id, sms_hash) at DB level,
-- causing the route's 23505 handler to fire instead of creating a second expense.
CREATE UNIQUE INDEX IF NOT EXISTS sms_parse_log_hash_unique_idx
  ON public.sms_parse_log (user_id, sms_hash)
  WHERE is_duplicate = false;
