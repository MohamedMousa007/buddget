-- Accounts refactor 3/5: server-written balance reports (SMS) + synced manual adjustments.
-- The gap is computed on the client (it owns the ledger); the server stores raw reports only.
CREATE TABLE IF NOT EXISTS public.account_balance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL,
  currency text,
  reported_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'sms',
  sms_parse_log_id uuid REFERENCES public.sms_parse_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_balance_reports_latest ON public.account_balance_reports (user_id, payment_method_id, reported_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_reports_sms ON public.account_balance_reports (sms_parse_log_id) WHERE sms_parse_log_id IS NOT NULL;
ALTER TABLE public.account_balance_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_balance_reports_select_own ON public.account_balance_reports;
CREATE POLICY account_balance_reports_select_own ON public.account_balance_reports
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.latest_balance_reports() RETURNS SETOF public.account_balance_reports
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT r.id, r.user_id, r.payment_method_id, r.balance, r.currency, r.reported_at, r.source, r.sms_parse_log_id, r.created_at
  FROM (
    SELECT t.*, row_number() OVER (PARTITION BY t.payment_method_id ORDER BY t.reported_at DESC) AS rn
    FROM public.account_balance_reports t WHERE t.user_id = (SELECT auth.uid())
  ) r WHERE r.rn <= 2
$$;
REVOKE ALL ON FUNCTION public.latest_balance_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.latest_balance_reports() TO authenticated;

CREATE TABLE IF NOT EXISTS public.account_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  delta numeric(14,2) NOT NULL,
  reason text NOT NULL CHECK (reason IN ('manual_update', 'gap', 'opening_correction')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_account_adjustments_pm ON public.account_adjustments (user_id, payment_method_id) WHERE deleted_at IS NULL;
ALTER TABLE public.account_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_adjustments_select_own ON public.account_adjustments;
DROP POLICY IF EXISTS account_adjustments_insert_own ON public.account_adjustments;
DROP POLICY IF EXISTS account_adjustments_update_own ON public.account_adjustments;
DROP POLICY IF EXISTS account_adjustments_delete_own ON public.account_adjustments;
CREATE POLICY account_adjustments_select_own ON public.account_adjustments FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY account_adjustments_insert_own ON public.account_adjustments FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY account_adjustments_update_own ON public.account_adjustments FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY account_adjustments_delete_own ON public.account_adjustments FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP TRIGGER IF EXISTS a_suppress_noop_updates ON public.account_adjustments;
CREATE TRIGGER a_suppress_noop_updates BEFORE UPDATE ON public.account_adjustments FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger();
DROP TRIGGER IF EXISTS trg_account_adjustments_updated_at ON public.account_adjustments;
CREATE TRIGGER trg_account_adjustments_updated_at BEFORE UPDATE ON public.account_adjustments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Patch the live definitions in place (same pattern as the rest of the schema): delta sync learns the new list,
-- housekeeping purges reports older than 14 days and tombstones of the new table.
DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.sync_table_delta(text, timestamptz)'::regprocedure);
  IF position($q$'recurring_savings_deposits','goals','buddgy_memories'$q$ IN d) = 0 THEN RAISE EXCEPTION 'sync_table_delta shape changed'; END IF;
  EXECUTE replace(d, $q$'recurring_savings_deposits','goals','buddgy_memories'$q$, $q$'recurring_savings_deposits','goals','buddgy_memories','account_adjustments'$q$);

  d := pg_get_functiondef('public.sync_pull(timestamptz)'::regprocedure);
  IF position($q$'recurring_savings_deposits','goals','buddgy_memories'$q$ IN d) = 0 THEN RAISE EXCEPTION 'sync_pull shape changed'; END IF;
  EXECUTE replace(d, $q$'recurring_savings_deposits','goals','buddgy_memories'$q$, $q$'recurring_savings_deposits','goals','buddgy_memories','account_adjustments'$q$);

  d := pg_get_functiondef('public.housekeeping(integer)'::regprocedure);
  IF position($q$'savings_transactions','subscriptions','buddgy_memories'$q$ IN d) = 0 OR position('  RETURN r;' IN d) = 0 THEN RAISE EXCEPTION 'housekeeping shape changed'; END IF;
  d := replace(d, $q$'savings_transactions','subscriptions','buddgy_memories'$q$, $q$'savings_transactions','subscriptions','buddgy_memories','account_adjustments'$q$);
  d := replace(d, '  RETURN r;', E'  DELETE FROM account_balance_reports WHERE reported_at < now() - interval ''14 days'';\n  RETURN r;');
  EXECUTE d;
END $$;
