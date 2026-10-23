-- FK cascade lookups (deleting a payment method) need an index that LEADS with payment_method_id; the composite ones lead with user_id.
CREATE INDEX IF NOT EXISTS idx_balance_reports_pm ON public.account_balance_reports (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_account_adjustments_pm_fk ON public.account_adjustments (payment_method_id);
