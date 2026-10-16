-- DB hardening after the 2026-10-17 slowdown (Nano instance, PostgREST schema-cache retry loop).
-- 1. RLS: wrap auth.uid()/auth.role() in a sub-select so Postgres evaluates it once per query, not per row.
-- 2. Drop an index identical to sms_parse_log_user_received_idx.
-- 3. Cover foreign keys so cascades and joins never seq-scan.

ALTER POLICY "own biometric device delete" ON public.biometric_devices USING ((select auth.uid()) = user_id);
ALTER POLICY "own biometric device read" ON public.biometric_devices USING ((select auth.uid()) = user_id);
ALTER POLICY push_tokens_select_own ON public.push_tokens USING ((select auth.uid()) = user_id);
ALTER POLICY receipts_delete_own ON public.receipts USING ((select auth.uid()) = user_id);
ALTER POLICY receipts_insert_own ON public.receipts WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY receipts_select_own ON public.receipts USING ((select auth.uid()) = user_id);
ALTER POLICY receipts_update_own ON public.receipts USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY savings_month_summary_select ON public.savings_month_summary USING ((select auth.uid()) = user_id);
ALTER POLICY sms_ingest_tokens_select_own ON public.sms_ingest_tokens USING ((select auth.uid()) = user_id);
ALTER POLICY sms_ingest_tokens_update_own ON public.sms_ingest_tokens USING ((select auth.uid()) = user_id);
ALTER POLICY sms_parse_log_select_own ON public.sms_parse_log USING ((select auth.uid()) = user_id);
ALTER POLICY "own signals readable" ON public.sms_template_signals USING ((select auth.uid()) = user_id);
ALTER POLICY service_role_only ON public.sms_promotion_config USING ((select auth.role()) = 'service_role');
ALTER POLICY service_role_only ON public.sms_template_users USING ((select auth.role()) = 'service_role');

DROP INDEX IF EXISTS public.sms_parse_log_user_day_idx;

CREATE INDEX IF NOT EXISTS idx_debts_linked_payment_method ON public.debts (linked_payment_method_id) WHERE linked_payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_receipt ON public.expenses (receipt_id) WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_refund_sms_log ON public.expenses (refund_sms_log_id) WHERE refund_sms_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_payment_method ON public.receipts (payment_method_id) WHERE payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_corrections_source_signal ON public.sms_corrections (source_signal_id) WHERE source_signal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_corrections_source_template ON public.sms_corrections (source_template_id) WHERE source_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_parse_log_expense ON public.sms_parse_log (expense_id) WHERE expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_parse_log_income ON public.sms_parse_log (income_id) WHERE income_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_templates_merged_into ON public.sms_tracking_templates_ai (merged_into) WHERE merged_into IS NOT NULL;
