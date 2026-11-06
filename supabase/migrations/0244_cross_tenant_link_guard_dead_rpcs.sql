-- QA6 DBS-1 / DBS-2 / DBI-8: cross-tenant write through subscriptions.linked_recurring_expense_id and the
-- SECURITY DEFINER composite RPCs that follow a link without a user_id filter.
-- 1) The six composite RPCs are called by nothing in src/ (verified by grep); revoke them from every client role.
-- 2) Attach private.assert_link_owner to the remaining user-writable link columns (same 23503 semantics as 0221).
-- DEPLOY: additive tightening, all live rows pass (violation counts were 0 for every column below).
-- ROLLBACK: GRANT EXECUTE on the six functions back to authenticated; drop the new link_guard_* triggers and
--           recreate link_guard_expenses with its 0221 argument list.

REVOKE ALL ON FUNCTION public.update_subscription_and_re(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reactivate_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_debt_payment_with_expense(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_income_with_debt(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_subscription_with_recurring_expense(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('subscriptions',             'payment_method_id,payment_methods,linked_recurring_expense_id,recurring_expenses'),
    ('recurring_expenses',        'payment_method_id,payment_methods,linked_subscription_id,subscriptions'),
    ('recurring_debt_payments',   'debt_id,debts,payment_method_id,payment_methods'),
    ('recurring_savings_deposits','account_id,savings_accounts'),
    ('savings_holdings',          'account_id,savings_accounts'),
    ('receipts',                  'payment_method_id,payment_methods'),
    ('expenses',                  'payment_method_id,payment_methods,linked_debt_id,debts,linked_debt_payment_id,debt_payments,to_payment_method_id,payment_methods,linked_subscription_id,subscriptions,receipt_id,receipts'),
    ('savings_accounts',          'linked_payment_method_id,payment_methods,held_in_payment_method_id,payment_methods')
  ) AS t(tbl, args) LOOP
    IF to_regclass('public.' || r.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS link_guard_%1$s ON public.%1$I', r.tbl);
      EXECUTE format(
        'CREATE TRIGGER link_guard_%1$s BEFORE INSERT OR UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION private.assert_link_owner(%2$s)',
        r.tbl, (SELECT string_agg(quote_literal(x), ',') FROM unnest(string_to_array(r.args, ',')) x));
    END IF;
  END LOOP;
END $$;
