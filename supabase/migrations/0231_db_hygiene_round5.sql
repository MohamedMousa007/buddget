-- QA round 5 database hygiene (DBL-4, 5, 6, 10, 11). Additive or reversible; applied live 2026-11-05.

-- DBL-10: the three positive-amount checks were NOT VALID although no row violates them.
ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_amount_pos;
ALTER TABLE public.debt_payments VALIDATE CONSTRAINT debt_payments_amount_pos;
ALTER TABLE public.income_events VALIDATE CONSTRAINT income_events_amount_pos;

-- DBL-5: foreign keys without a covering index (parent deletes and account erasure scanned these tables).
CREATE INDEX IF NOT EXISTS sms_parse_log_debt_payment_idx ON public.sms_parse_log (debt_payment_id) WHERE debt_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_parse_log_learn_template_idx ON public.sms_parse_log (learn_template_id) WHERE learn_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_parse_log_paired_log_idx ON public.sms_parse_log (paired_log_id) WHERE paired_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_parse_log_savings_tx_idx ON public.sms_parse_log (savings_transaction_id) WHERE savings_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_log_user_idx ON public.email_log (user_id);
CREATE INDEX IF NOT EXISTS merchant_category_votes_user_idx ON public.merchant_category_votes (user_id);
CREATE INDEX IF NOT EXISTS sms_stats_outbox_user_idx ON public.sms_stats_outbox (user_id);
CREATE INDEX IF NOT EXISTS sms_template_hard_signals_user_idx ON public.sms_template_hard_signals (user_id);
CREATE INDEX IF NOT EXISTS sms_template_users_user_idx ON public.sms_template_users (user_id);
CREATE INDEX IF NOT EXISTS profiles_active_budget_plan_idx ON public.profiles (active_budget_plan_id) WHERE active_budget_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_default_carry_pocket_idx ON public.profiles (default_carry_pocket_id) WHERE default_carry_pocket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS savings_accounts_linked_pm_idx ON public.savings_accounts (linked_payment_method_id) WHERE linked_payment_method_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS savings_month_summary_pocket_idx ON public.savings_month_summary (pocket_id) WHERE pocket_id IS NOT NULL;

-- DBL-11: indexes that are a prefix of another index on the same table.
DROP INDEX IF EXISTS public.idx_expenses_user;
DROP INDEX IF EXISTS public.push_tokens_user_idx;

-- DBL-4: write privileges on tables whose only policy is SELECT (RLS already denies them; this removes the second line of defence's single point of failure).
REVOKE INSERT, UPDATE, DELETE ON public.site_leads, public.site_stats, public.asset_prices, public.merchant_categories, public.sms_parse_log FROM authenticated;

-- DBL-6: keep a week of cron run details so a failing job can be audited.
SELECT cron.alter_job(3, command := 'DELETE FROM cron.job_run_details WHERE end_time < now() - interval ''7 days''');
