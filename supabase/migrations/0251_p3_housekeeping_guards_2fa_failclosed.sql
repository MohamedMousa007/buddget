-- QA6 P3 closing (db-integrity / db-security functions): DBI-2, DBI-3, DBI-6, DBI-10, DBS-7.
-- STATUS: APPLIED LIVE (ydihurtbcnoflhormgzi). No existing row is rewritten or deleted by this file.
-- ROLLBACK: DROP TRIGGER budget_plans_tombstone_activations; re-create housekeeping()/sms_retention()/private.two_factor_gate()
--   from 0224/0236-era definitions (git history of this file's predecessors) or remove the guard clauses added below.

-- DBI-2: a deleted plan takes its activation log with it (client delete path never did; one live row was stale).
CREATE OR REPLACE FUNCTION private.tombstone_plan_activations()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.budget_plan_activations
       SET deleted_at = NEW.deleted_at
     WHERE plan_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS budget_plans_tombstone_activations ON public.budget_plans;
CREATE TRIGGER budget_plans_tombstone_activations AFTER UPDATE OF deleted_at ON public.budget_plans
  FOR EACH ROW EXECUTE FUNCTION private.tombstone_plan_activations();

-- DBI-6: the 90-day tombstone purge never removes a row a live row still points at (no FK on these links by design:
-- sync pushes tables in arbitrary order, so an FK would park legitimate offline rows).
CREATE OR REPLACE FUNCTION private.tombstone_purge_guard(t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE t
    WHEN 'savings_transactions' THEN
      'AND NOT EXISTS (SELECT 1 FROM public.expenses x WHERE x.funded_from_savings_tx_id = savings_transactions.id AND x.deleted_at IS NULL) '
      'AND NOT EXISTS (SELECT 1 FROM public.debt_payments x WHERE x.funded_from_savings_tx_id = savings_transactions.id AND x.deleted_at IS NULL)'
    WHEN 'recurring_expenses' THEN
      'AND NOT EXISTS (SELECT 1 FROM public.subscriptions x WHERE x.linked_recurring_expense_id = recurring_expenses.id AND x.deleted_at IS NULL)'
    ELSE ''
  END
$$;

DO $$
DECLARE d text; marker text := $q$interval ''90 days'' LIMIT 2000)', t, t);$q$;
BEGIN
  d := pg_get_functiondef('public.housekeeping(integer)'::regprocedure);
  IF position(marker in d) = 0 THEN RAISE EXCEPTION 'housekeeping: tombstone delete clause not found'; END IF;
  d := replace(d, marker, $q$interval ''90 days'' ' || private.tombstone_purge_guard(t) || ' LIMIT 2000)', t, t);$q$);
  EXECUTE d;
END $$;

-- DBI-3: a failed parse-log row that a user row still points at is never deleted.
DO $$
DECLARE d text; marker text := 'AND savings_transaction_id IS NULL AND paired_log_id IS NULL';
BEGIN
  d := pg_get_functiondef('public.sms_retention()'::regprocedure);
  IF position(marker in d) = 0 THEN RAISE EXCEPTION 'sms_retention: failed-delete clause not found'; END IF;
  d := replace(d, marker, marker
    || ' AND NOT EXISTS (SELECT 1 FROM expenses x WHERE x.sms_log_id = sms_parse_log.id)'
    || ' AND NOT EXISTS (SELECT 1 FROM income_events x WHERE x.sms_log_id = sms_parse_log.id)'
    || ' AND NOT EXISTS (SELECT 1 FROM debt_payments x WHERE x.sms_log_id = sms_parse_log.id)');
  EXECUTE d;
END $$;

-- DBS-7: in enforce mode a malformed claim or a failure after the mode is known blocks instead of skipping the gate.
-- (Mode stays `report` today; an unreadable settings row, where the mode is unknown, still skips.)
DO $$
DECLARE d text;
  marker text := E'  exception when others then\n    return;\n  end;\n\n  begin\n    sid :=';
BEGIN
  d := pg_get_functiondef('private.two_factor_gate()'::regprocedure);
  IF position(marker in d) = 0 THEN RAISE EXCEPTION 'two_factor_gate: first handler not found'; END IF;
  d := replace(d, marker, E'  exception when others then\n    if coalesce(mode, ''off'') = ''enforce'' then raise; end if;\n    return;\n  end;\n\n  begin\n    sid :=');
  EXECUTE d;
END $$;

-- DBI-10: debts.remaining_amount is derived on the client. It stays nullable because installed builds still send it
-- as null (dropping the column would make PostgREST reject every debt upsert from them).
COMMENT ON COLUMN public.debts.remaining_amount IS
  'DEPRECATED, always NULL. Remaining balance is derived (amount minus payments) in src/lib/debts; the client mapper still writes null so older builds keep syncing.';
