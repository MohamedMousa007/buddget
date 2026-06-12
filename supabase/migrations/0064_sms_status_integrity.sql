-- Migration 0064: SMS status integrity — loud auto-add failures.
-- Adds two honest states so a parsed SMS can never silently fail to become a row:
--   add_failed → parse succeeded but the expense/income INSERT failed. The row is
--     kept recoverable (parsed_ok=true, awaiting_confirmation=true) so it shows in
--     the in-app rescue banner and via /api/sms/confirm, and is flagged in admin.
--   tapped → the user manually rescued the transaction (a warning state) so the
--     tech team can see that auto-add needed human intervention.

ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_status_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_status_check
  CHECK (status IN ('processing','rejected','failed','logged','notified','rendered','confirmed','add_failed','tapped'));

COMMENT ON COLUMN public.sms_parse_log.status IS
  'processing→claim; rejected→not a txn/low-confidence; failed→parse/AI error; add_failed→parsed but expense/income insert failed (recoverable); logged→row created; notified→push delivered (sent>=1); rendered→app acked render but push not delivered; confirmed→BOTH push delivered AND app acked; tapped→user manually added after auto-add failed / low-confidence confirm.';

-- sms_mark_pushed must record push delivery for add_failed rows (the "tap to add"
-- push) WITHOUT promoting them out of the failed state — a failed row must never
-- look like a delivered success.
CREATE OR REPLACE FUNCTION public.sms_mark_pushed(p_log_id uuid, p_result jsonb, p_delivered boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.sms_parse_log SET
    push_result  = p_result,
    pushed_at    = CASE WHEN p_delivered THEN now() ELSE pushed_at END,
    status       = CASE WHEN status = 'add_failed' THEN 'add_failed'
                        WHEN NOT p_delivered THEN status
                        WHEN acked_at IS NOT NULL THEN 'confirmed' ELSE 'notified' END,
    confirmed_at = CASE WHEN p_delivered AND acked_at IS NOT NULL THEN now() ELSE confirmed_at END
  WHERE id = p_log_id AND status IN ('logged','notified','rendered','add_failed');
END $$;

-- sms_mark_acked is unchanged: its WHERE already excludes add_failed/tapped, so a
-- realtime ack after a manual rescue leaves the 'tapped' state intact.
