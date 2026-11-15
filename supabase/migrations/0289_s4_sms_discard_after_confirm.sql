-- S4 U-1 remainder. An undo can land while /api/sms/confirm is still booking a message. The undo retires what exists at
-- that moment and marks the message undone; whatever confirm writes afterwards (a debt payment, a pair) was left live,
-- because sms_discard_message returns early on an undone message.
--
-- Confirm now calls this once its own writes are finished and it finds the message undone. It takes the same per-user
-- lock as sms_discard_message and sms_try_pair, reopens the message inside the transaction and runs the full discard,
-- so everything booked in the window is reversed the same way an ordinary undo reverses it.
--
-- ponytail: reuses sms_discard_message by flipping the status inside one transaction instead of adding a force
-- argument to a 290-line function. Fold it in as a parameter if that function is rewritten for another reason.

CREATE OR REPLACE FUNCTION public.sms_discard_after_confirm(p_user_id uuid, p_log_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_log_id IS NULL THEN
    RAISE EXCEPTION 'user and sms log are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('sms_try_pair:' || p_user_id::text, 0));

  -- Only a message an undo has already finished is reopened; anything else is an ordinary undo's job.
  UPDATE public.sms_parse_log SET status = 'tapped'
   WHERE id = p_log_id AND user_id = p_user_id AND status = 'undone';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'nothing_to_do', true);
  END IF;

  v_result := public.sms_discard_message(p_user_id, p_log_id);

  -- The discard leaves the status alone when it found nothing to reverse: the message is undone either way.
  UPDATE public.sms_parse_log
     SET expense_id = NULL, income_id = NULL, debt_payment_id = NULL, awaiting_confirmation = false,
         parsed_ok = false, status = 'undone'
   WHERE id = p_log_id AND status <> 'undone';

  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.sms_discard_after_confirm(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sms_discard_after_confirm(uuid, uuid) TO service_role;
