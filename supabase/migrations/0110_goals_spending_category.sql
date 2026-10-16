-- spending_control goals: the expense category the monthly limit applies to; NULL = all spending.
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS spending_category text;
COMMENT ON COLUMN public.goals.spending_category IS 'spending_control goals: the expense category the monthly limit applies to; NULL = all spending.';
