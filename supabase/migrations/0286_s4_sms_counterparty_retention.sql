-- S4 closing batch (docs/launch/S4-security.md section 8), applied after the S3 repair inserts, which read clean_title.
-- Counterparty names: on transfer kinds sms_parse_log.clean_title is a person's name, and merchant,
--    merchant_normalized and raw_sms_summary carry the same name (184 of the 228 old rows have merchant set). All four
--    now leave with the raw text; a row still waiting for the user's answer is kept. Same age setting as the raw
--    text (sms_raw_keep_days_parsed, default 30 days). The booked row keeps its own description.
--    The retention function is patched in place so its other steps stay byte-identical.
do $do$
declare
  v_def text := pg_get_functiondef('public.sms_retention()'::regprocedure);
  v_anchor text := '  DELETE FROM sms_corpus WHERE seen_count < 3';
  v_block text := $blk$  WITH t AS (SELECT id FROM sms_parse_log
              WHERE kind IN ('instant_transfer_out', 'instant_transfer_in', 'own_transfer')
                AND (clean_title IS NOT NULL OR merchant IS NOT NULL OR merchant_normalized IS NOT NULL OR raw_sms_summary IS NOT NULL)
                AND coalesce(awaiting_confirmation, false) = false
                AND received_at < now() - make_interval(days => v_parsed_days)
              LIMIT 5000 FOR UPDATE SKIP LOCKED)
  UPDATE sms_parse_log l SET clean_title = NULL, merchant = NULL, merchant_normalized = NULL, raw_sms_summary = NULL FROM t WHERE l.id = t.id;

$blk$;
begin
  if position('SET clean_title = NULL' in v_def) > 0 then return; end if;
  if position(v_anchor in v_def) = 0 then raise exception 'sms_retention: anchor not found'; end if;
  execute replace(v_def, v_anchor, v_block || v_anchor);
end $do$;

-- Backfill: the rows already past the age (228 counted on 2026-11-15: 119 transfer out, 103 transfer in, 6 own transfer; none waiting).
update public.sms_parse_log
   set clean_title = null, merchant = null, merchant_normalized = null, raw_sms_summary = null
 where kind in ('instant_transfer_out', 'instant_transfer_in', 'own_transfer')
   and (clean_title is not null or merchant is not null or merchant_normalized is not null or raw_sms_summary is not null)
   and coalesce(awaiting_confirmation, false) = false
   and received_at < now() - make_interval(days => coalesce(private.sms_setting_num('sms_raw_keep_days_parsed', 30)::int, 30));
