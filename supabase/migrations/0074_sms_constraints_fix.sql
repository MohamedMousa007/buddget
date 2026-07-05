-- Migration 0074: fix SMS parse log constraints that blocked paired transfers and DB-template rows.
--
-- 1. Add 'paired' to status values (transfer-leg rows that reconcile without posting an expense).
--    Previously missing, causing status='paired' UPDATE to fail with constraint violation → 500.
-- 2. Add 'template' to parse_method values (DB-learned regex templates).
--    Previously missing; 'static' was the legacy name; 'template' is the current code value.

ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_status_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_status_check
  CHECK (status = ANY (ARRAY[
    'processing', 'rejected', 'failed', 'logged', 'notified',
    'rendered', 'confirmed', 'add_failed', 'tapped', 'paired'
  ]));

ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_parse_method_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_parse_method_check
  CHECK (parse_method = ANY (ARRAY['ai', 'static', 'curated', 'template']));
