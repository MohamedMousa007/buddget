-- Migration 0065: BUD-43 — a tracked SMS is "confirmed" once the APP has it.
--
-- Before: `confirmed` required BOTH an app ack AND a delivered push. Push
-- delivery is the flaky axis (Vercel after() can be killed, FCM tokens go
-- stale), so a transaction the app successfully logged would sit at `rendered`
-- forever and show as "not confirmed" in admin — exactly BUD-43. Push delivery
-- is a notification nicety, not proof the transaction was tracked.
--
-- After: an ack alone → `confirmed` (the app rendered/has the row). Push
-- delivery truth still lives in `pushed_at` / `push_result` for the tech team;
-- it no longer gates the status. `rendered` remains a valid legacy enum value
-- but new rows skip straight to `confirmed` on ack.

-- Ack means the app has the transaction → confirmed, regardless of push.
CREATE OR REPLACE FUNCTION public.sms_mark_acked(p_log_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.sms_parse_log SET
    acked_at     = COALESCE(acked_at, now()),
    parsed_ok    = true,
    status       = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = p_log_id AND user_id = p_user_id
    AND status IN ('logged','notified','rendered');
END $$;

-- Push delivery records its truth (pushed_at / push_result) even on rows that
-- are already `confirmed`, but never changes a terminal status. A delivered
-- push with no ack yet → `notified`; the following ack promotes it to confirmed.
CREATE OR REPLACE FUNCTION public.sms_mark_pushed(p_log_id uuid, p_result jsonb, p_delivered boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.sms_parse_log SET
    push_result  = p_result,
    pushed_at    = CASE WHEN p_delivered THEN COALESCE(pushed_at, now()) ELSE pushed_at END,
    status       = CASE WHEN status IN ('add_failed','confirmed','tapped') THEN status
                        WHEN NOT p_delivered THEN status
                        WHEN acked_at IS NOT NULL THEN 'confirmed' ELSE 'notified' END,
    confirmed_at = CASE WHEN p_delivered AND acked_at IS NOT NULL
                        THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END
  WHERE id = p_log_id
    AND status IN ('logged','notified','rendered','add_failed','confirmed');
END $$;

-- Backfill: any already-acked transaction stuck below confirmed (the classic
-- push-never-delivered `rendered`, plus logged/notified that were acked) is a
-- success the app has — promote it.
UPDATE public.sms_parse_log
SET status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, acked_at, now())
WHERE status IN ('logged','notified','rendered')
  AND acked_at IS NOT NULL;
