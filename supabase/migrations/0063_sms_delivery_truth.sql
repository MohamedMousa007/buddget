-- Migration 0063: honest two-axis SMS delivery status.
-- "confirmed" (true success) requires BOTH a delivered push AND an app-render ack.
-- Push and render are independent timestamps; whichever lands second flips to
-- confirmed. New 'rendered' state = app got it but push never delivered.

-- 1. widen the status domain + add the render-ack timestamp
ALTER TABLE public.sms_parse_log DROP CONSTRAINT IF EXISTS sms_parse_log_status_check;
ALTER TABLE public.sms_parse_log ADD CONSTRAINT sms_parse_log_status_check
  CHECK (status IN ('processing','rejected','failed','logged','notified','rendered','confirmed'));
ALTER TABLE public.sms_parse_log ADD COLUMN IF NOT EXISTS acked_at timestamptz;

COMMENT ON COLUMN public.sms_parse_log.status IS
  'processing→claim; rejected→not a txn/low-confidence; failed→parse/AI/save error; logged→expense created; notified→push delivered (sent>=1); rendered→app acked render but push not delivered; confirmed→BOTH push delivered AND app acked (true success).';

-- 2. atomic, race-free transitions. Each reads the other axis from the row, so
--    whichever of push/ack commits second flips the row to 'confirmed'.
CREATE OR REPLACE FUNCTION public.sms_mark_pushed(p_log_id uuid, p_result jsonb, p_delivered boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.sms_parse_log SET
    push_result  = p_result,
    pushed_at    = CASE WHEN p_delivered THEN now() ELSE pushed_at END,
    status       = CASE WHEN NOT p_delivered THEN status
                        WHEN acked_at IS NOT NULL THEN 'confirmed' ELSE 'notified' END,
    confirmed_at = CASE WHEN p_delivered AND acked_at IS NOT NULL THEN now() ELSE confirmed_at END
  WHERE id = p_log_id AND status IN ('logged','notified','rendered');
END $$;

CREATE OR REPLACE FUNCTION public.sms_mark_acked(p_log_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.sms_parse_log SET
    acked_at     = COALESCE(acked_at, now()),
    parsed_ok    = true,
    status       = CASE WHEN pushed_at IS NOT NULL THEN 'confirmed' ELSE 'rendered' END,
    confirmed_at = CASE WHEN pushed_at IS NOT NULL THEN now() ELSE confirmed_at END
  WHERE id = p_log_id AND user_id = p_user_id AND status IN ('logged','notified','rendered');
END $$;

-- 3. backfill: old 'confirmed' rows that never actually pushed were confirmed by
--    the background realtime ack alone — reclassify them honestly as 'rendered'.
UPDATE public.sms_parse_log
  SET acked_at = COALESCE(acked_at, confirmed_at), status = 'rendered', confirmed_at = NULL
  WHERE status = 'confirmed' AND pushed_at IS NULL;
UPDATE public.sms_parse_log
  SET acked_at = COALESCE(acked_at, confirmed_at)
  WHERE status = 'confirmed' AND acked_at IS NULL;
