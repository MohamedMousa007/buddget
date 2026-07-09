-- Refunds/declines merge into the original expense instead of a one-time income.
-- refunded_at non-null = this expense was reversed (excluded from spend, shown struck).
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_kind text
    CHECK (refund_kind IS NULL OR refund_kind IN ('refunded', 'declined')),
  ADD COLUMN IF NOT EXISTS refund_sms_log_id uuid
    REFERENCES public.sms_parse_log(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.expenses.refunded_at IS
  'Set when this expense was reversed by a refund/decline SMS; excludes it from spend totals.';
COMMENT ON COLUMN public.expenses.refund_kind IS
  'refunded = money returned; declined = charge blocked/reversed. Drives the card badge.';
COMMENT ON COLUMN public.expenses.refund_sms_log_id IS
  'Provenance: the sms_parse_log row that reversed this expense.';
