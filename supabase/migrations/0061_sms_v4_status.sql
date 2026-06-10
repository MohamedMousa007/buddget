-- Migration 0061: SMS v4 — real delivery status model + accurate distinct-user tracking

-- 1. Delivery status model on sms_parse_log.
-- Replaces the binary parsed_ok semantics: a row is only "confirmed" once the
-- app acks that the expense actually rendered. Push send results are recorded
-- so failures are visible instead of being silently console.log'd.
ALTER TABLE public.sms_parse_log
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','rejected','failed','logged','notified','confirmed')),
  ADD COLUMN IF NOT EXISTS pushed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS push_result  jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sms_parse_log_status
  ON public.sms_parse_log (status, received_at DESC);

COMMENT ON COLUMN public.sms_parse_log.status IS
  'processing=initial claim; rejected=not a txn/low-confidence; failed=parse/AI/save error; logged=expense created server-side; notified=push send returned sent>=1; confirmed=app acked render (true success).';

-- 2. Accurate distinct-user tracking per learned/promoted template.
-- Templates are global (user_id null), so unique_user_count cannot be derived
-- from the template row. This junction records every distinct user a template
-- has matched, and unique_user_count is recomputed from it.
CREATE TABLE IF NOT EXISTS public.sms_template_users (
  template_id uuid NOT NULL REFERENCES public.sms_tracking_templates_ai(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, user_id)
);

ALTER TABLE public.sms_template_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.sms_template_users
  USING (auth.role() = 'service_role');
