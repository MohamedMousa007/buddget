-- Database hygiene (scaling plan phase 0/1). No behaviour change for the app.
-- 1. Writes that change nothing are dropped before they become row versions, WAL and trigger work.
-- 2. sms_parse_log: duplicate index removed; the status index removed so status changes can be HOT updates.
-- 3. Telemetry table is UNLOGGED (no WAL, no fsync); it is rolled up daily so a crash loses at most a day of raw rows.
-- 4. Internal trigger functions are no longer callable as /rest/v1/rpc; function search_path pinned.
-- 5. Application roles get statement and idle-transaction timeouts.

-- 1a. No-op updates are suppressed (fires first: trigger names run alphabetically, before set_updated_at).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'expenses','income_events','income_sources','debts','debt_payments','goals','budget_plans','budget_categories',
    'budget_subcategories','payment_methods','recurring_debt_payments','recurring_expenses','recurring_savings_deposits',
    'savings_accounts','savings_holdings','savings_transactions','subscriptions','profiles','user_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS a_suppress_noop_updates ON public.%I', t);
    EXECUTE format('CREATE TRIGGER a_suppress_noop_updates BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger()', t);
  END LOOP;
END $$;

-- 1b. SMS learning triggers only run when something they care about changed (the functions already returned early otherwise).
DROP TRIGGER IF EXISTS sms_signal_on_expense_update ON public.expenses;
CREATE TRIGGER sms_signal_on_expense_update AFTER UPDATE ON public.expenses FOR EACH ROW
  WHEN (NEW.sms_log_id IS NOT NULL AND (
    OLD.amount IS DISTINCT FROM NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency OR
    OLD.expense_date IS DISTINCT FROM NEW.expense_date OR OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at))
  EXECUTE FUNCTION record_sms_template_signal();

DROP TRIGGER IF EXISTS sms_signal_on_income_update ON public.income_events;
CREATE TRIGGER sms_signal_on_income_update AFTER UPDATE ON public.income_events FOR EACH ROW
  WHEN (NEW.sms_log_id IS NOT NULL AND (
    OLD.amount IS DISTINCT FROM NEW.amount OR OLD.currency IS DISTINCT FROM NEW.currency OR
    OLD.received_date IS DISTINCT FROM NEW.received_date OR OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at))
  EXECUTE FUNCTION record_sms_template_signal();

DROP TRIGGER IF EXISTS trg_remember_merchant_category ON public.expenses;
CREATE TRIGGER trg_remember_merchant_category AFTER UPDATE OF category ON public.expenses FOR EACH ROW
  WHEN (OLD.category IS DISTINCT FROM NEW.category AND NEW.sms_log_id IS NOT NULL)
  EXECUTE FUNCTION remember_merchant_category_on_edit();

-- 2. sms_parse_log indexes.
DROP INDEX IF EXISTS public.sms_parse_log_hash_idx;          -- duplicate of the unique and the partial (user_id, sms_hash) indexes
DROP INDEX IF EXISTS public.idx_sms_parse_log_status;         -- status changes on every transition; indexing it forbids HOT updates
CREATE INDEX IF NOT EXISTS sms_parse_log_received_idx ON public.sms_parse_log (received_at DESC);

-- 3. Telemetry: no WAL.
ALTER TABLE public.app_analytics_events SET UNLOGGED;

-- 4. Internal functions are not part of the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_sms_template_signal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remember_merchant_category_on_edit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.ai_default_limits() SET search_path = public, pg_temp;

-- 5. Timeouts for application roles (service_role is left alone: admin and cron jobs run long on purpose).
ALTER ROLE authenticated SET statement_timeout = '15s';
ALTER ROLE anon SET statement_timeout = '8s';
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE anon SET idle_in_transaction_session_timeout = '30s';
NOTIFY pgrst, 'reload config';
