-- Persisted anchor day so month-end schedules (31st) return to their day after short months.
ALTER TABLE public.recurring_debt_payments
  ADD COLUMN IF NOT EXISTS due_day smallint CHECK (due_day BETWEEN 1 AND 31);

UPDATE public.recurring_debt_payments
SET due_day = EXTRACT(DAY FROM next_due_date)::smallint
WHERE due_day IS NULL AND next_due_date IS NOT NULL;
