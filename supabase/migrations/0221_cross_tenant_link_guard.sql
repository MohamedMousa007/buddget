-- QA2 follow-up: a FOREIGN KEY accepts a link to ANOTHER user's row (live had one confirmed income event pointing at a
-- different user's income_source). SECURITY DEFINER composite RPCs got ownership asserts in 0198; this closes the same
-- hole for plain table writes (sync upserts). The trigger raises foreign_key_violation (23503), so the sync runner's
-- per-row retry isolates the bad row instead of failing the whole batch.
-- DEPLOY: additive tightening. All live rows pass (verified: one pre-existing violation was repaired by hand first).
-- ROLLBACK: drop the triggers named link_guard_* on the tables below.

CREATE OR REPLACE FUNCTION private.assert_link_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  i int := 0;
  col text; parent text; val text; ok boolean;
BEGIN
  -- TG_ARGV = [column, parent_table, column, parent_table, ...]
  WHILE i < TG_NARGS LOOP
    col := TG_ARGV[i]; parent := TG_ARGV[i + 1];
    val := to_jsonb(NEW) ->> col;
    IF val IS NOT NULL AND val <> '' THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1::uuid AND user_id = $2)', parent)
        INTO ok USING val, NEW.user_id;
      IF NOT ok THEN
        -- A missing parent is left to the foreign key (same 23503); a parent owned by someone else is refused here.
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id = $1::uuid)', parent) INTO ok USING val;
        IF ok THEN
          RAISE EXCEPTION 'link %.% points at another user''s row', TG_TABLE_NAME, col USING ERRCODE = '23503';
        END IF;
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.assert_link_owner() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('income_events',   'template_id,income_sources,linked_debt_id,debts,linked_savings_account_id,savings_accounts,payment_method_id,payment_methods'),
    ('income_sources',  'linked_debt_id,debts,linked_savings_account_id,savings_accounts,payment_method_id,payment_methods'),
    ('expenses',        'payment_method_id,payment_methods,linked_debt_id,debts,linked_debt_payment_id,debt_payments'),
    ('debt_payments',   'debt_id,debts,payment_method_id,payment_methods'),
    ('savings_transactions','account_id,savings_accounts,payment_method_id,payment_methods'),
    ('savings_accounts','linked_payment_method_id,payment_methods'),
    ('debts',           'linked_credit_card_debt_id,debts,linked_payment_method_id,payment_methods')
  ) AS t(tbl, args) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS link_guard_%1$s ON public.%1$I', r.tbl);
      EXECUTE format(
        'CREATE TRIGGER link_guard_%1$s BEFORE INSERT OR UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.assert_link_owner(%2$s)',
        r.tbl, (SELECT string_agg(quote_literal(x), ',') FROM unnest(string_to_array(r.args, ',')) x));
    END IF;
  END LOOP;
END $$;
