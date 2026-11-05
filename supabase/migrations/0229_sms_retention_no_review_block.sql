-- QA round 5, SIT1. The privacy policy promises raw SMS text is deleted after at most 30 days. The 30-day purge of parsed
-- rows also required a human "pattern review" row covering the message date (private.sms_review_covers); none was ever
-- recorded, so parsed_masked stayed 0 on every run and 171 rows past 30 days kept their raw text up to the 60-day cap.
-- A message that is learned, has a current masked copy and is not waiting for the user is purged at 30 days; the review
-- no longer gates it. v_held now means "a parsed row older than the limit still holds raw text after this run".
CREATE OR REPLACE FUNCTION public.sms_retention()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rej_days int := private.sms_setting_num('sms_raw_keep_days_rejected', 7)::int;
  v_parsed_days int := private.sms_setting_num('sms_raw_keep_days_parsed', 30)::int;
  v_cap_days int := private.sms_setting_num('sms_raw_hard_cap_days', 60)::int;
  v_corpus_days int := private.sms_setting_num('sms_corpus_keep_days', 180)::int;
  v_failed_days int := private.sms_setting_num('sms_failed_keep_days', 35)::int;
  v_min_version numeric := private.sms_setting_num('sms_masked_version_min', 1);
  v_held boolean := false;
  v_rej int := 0; v_rej_cap int := 0; v_parsed int := 0; v_never int := 0;
  v_fail_blank int := 0; v_fail_del int := 0; v_corpus int := 0; v_expl int := 0;
BEGIN
  IF NOT coalesce((SELECT value = 'true'::jsonb FROM platform_settings WHERE key = 'sms_retention_enabled'), false) THEN
    RETURN 0;
  END IF;
  IF NOT private.sms_leak_scan_ok() THEN
    INSERT INTO sms_retention_audit (outcome) VALUES ('blocked_leak_scan');
    RETURN 0;
  END IF;

  WITH t AS (SELECT id FROM sms_parse_log WHERE raw_body IS NOT NULL AND raw_expires_at <= now() LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_expl FROM u;

  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status = 'rejected' AND raw_body IS NOT NULL
                AND (learned_at IS NOT NULL OR received_at < now() - make_interval(days => v_rej_days))
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING l.learned_at)
  SELECT count(*), count(*) FILTER (WHERE learned_at IS NULL) INTO v_rej, v_rej_cap FROM u;

  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status = 'failed' AND raw_body IS NOT NULL AND received_at < now() - make_interval(days => v_rej_days)
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_fail_blank FROM u;
  WITH d AS (DELETE FROM sms_parse_log
              WHERE id IN (SELECT id FROM sms_parse_log
                            WHERE status = 'failed' AND received_at < now() - make_interval(days => v_failed_days)
                              AND expense_id IS NULL AND income_id IS NULL AND debt_payment_id IS NULL
                              AND savings_transaction_id IS NULL AND paired_log_id IS NULL
                            LIMIT 5000)
              RETURNING 1)
  SELECT count(*) INTO v_fail_del FROM d;

  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                AND coalesce(awaiting_confirmation, false) = false
                AND received_at < now() - make_interval(days => v_parsed_days)
                AND learned_at IS NOT NULL AND masked_body IS NOT NULL AND coalesce(masked_version, 0) >= v_min_version
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_parsed FROM u;
  SELECT EXISTS (SELECT 1 FROM sms_parse_log
                  WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                    AND received_at < now() - make_interval(days => v_parsed_days)) INTO v_held;

  WITH t AS (SELECT id FROM sms_parse_log
              WHERE status NOT IN ('rejected', 'failed', 'processing') AND raw_body IS NOT NULL
                AND received_at < now() - make_interval(days => v_cap_days)
              LIMIT 5000 FOR UPDATE SKIP LOCKED),
       u AS (UPDATE sms_parse_log l SET raw_body = NULL, push_result = NULL FROM t WHERE l.id = t.id RETURNING 1)
  SELECT count(*) INTO v_never FROM u;

  DELETE FROM sms_corpus WHERE seen_count < 3 AND last_seen < now() - make_interval(days => v_corpus_days);
  GET DIAGNOSTICS v_corpus = ROW_COUNT;

  INSERT INTO sms_retention_audit (outcome, rejected_purged, rejected_cap_fired, parsed_masked, parsed_held,
                                   never_learned_purged, failed_blanked, failed_deleted, corpus_dropped, explicit_expired)
  VALUES ('ran', v_rej, v_rej_cap, v_parsed, v_held, v_never, v_fail_blank, v_fail_del, v_corpus, v_expl);

  RETURN v_rej + v_parsed + v_never + v_fail_blank + v_expl;
END $function$;
