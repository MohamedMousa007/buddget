-- Wealth v3: synced gold-strip state + daily net-worth snapshots for the 30-day trend.
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS wealth_gold_strip text NOT NULL DEFAULT 'collapsed'
  CHECK (wealth_gold_strip IN ('collapsed','expanded','hidden'));

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  net_worth numeric NOT NULL,
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY net_worth_snapshots_select_own ON public.net_worth_snapshots FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY net_worth_snapshots_insert_own ON public.net_worth_snapshots FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY net_worth_snapshots_update_own ON public.net_worth_snapshots FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY net_worth_snapshots_delete_own ON public.net_worth_snapshots FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
