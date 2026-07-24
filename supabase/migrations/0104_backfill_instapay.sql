-- 0104 — reclassify existing Egyptian-IPN sends from Remittance to Instapay.
--
-- Separate from 0103 because Postgres cannot use a newly-added enum value in the same
-- transaction that created it. Matches the same markers the app uses (IPN / تحويل لحظي /
-- instapay) on SMS-sourced instant-transfer expenses, so the ledger the user already sees
-- updates retroactively — not just future rows.
update expenses e
   set category = 'Instapay', updated_at = now()
  from sms_parse_log l
 where l.id = e.sms_log_id
   and e.category = 'Remittance'
   and e.deleted_at is null
   and l.kind = 'instant_transfer_out'
   and l.raw_body ~* '(\yIPN\y|تحويل\s+لحظ[يى]|instapay)';
