-- One row per user per closed budget cycle: the month-end carry ledger.
--
-- `carry` is the amount actually swept into savings when the month closed. It is IMMUTABLE
-- once written — a late expense/income for that month is NOT allowed to rewrite it (that would
-- mutate history and could drive a pocket negative). Instead the delta accumulates in
-- `carry_adjustment` and is netted against the NEXT cycle's carry (F1/F13). Only the most
-- recently closed month is ever recomputed; older rows are frozen, so corrections never cascade.
--
-- `target` is snapshotted at close from the plan active then (`active_budget_plan_id`), so later
-- plan edits don't rewrite history. `saved = allocated + carry`. The UNIQUE key is also the
-- idempotency guard: the cron can run repeatedly and never double-post a cycle.
CREATE TABLE IF NOT EXISTS public.savings_month_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key text NOT NULL,              -- 'YYYY-MM' of the closed cycle
  target numeric NOT NULL DEFAULT 0,
  allocated numeric NOT NULL DEFAULT 0,
  carry numeric NOT NULL DEFAULT 0,
  carry_adjustment numeric NOT NULL DEFAULT 0,
  saved numeric NOT NULL DEFAULT 0,
  currency currency_code NOT NULL,
  pocket_id uuid,                        -- destination pocket the carry landed in
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT savings_month_summary_user_month_key UNIQUE (user_id, month_key)
);

ALTER TABLE public.savings_month_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS savings_month_summary_select ON public.savings_month_summary;
CREATE POLICY savings_month_summary_select ON public.savings_month_summary
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
