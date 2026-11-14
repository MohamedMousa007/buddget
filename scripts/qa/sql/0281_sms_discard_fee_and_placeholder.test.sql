-- Paste into the SQL console AFTER migration 0281 is applied (it lives here, not in supabase/migrations, because the migration check scans that folder). Synthetic rows for an existing user; always ends with an exception ('ROLLBACK_OK <result>') so nothing persists. Every result line is PASS or FAIL.
do $$
declare
  u uuid;
  res text := '';
  r jsonb;
  la uuid := gen_random_uuid(); ls uuid := gen_random_uuid(); ea uuid := gen_random_uuid(); fee uuid := gen_random_uuid();
  lp uuid := gen_random_uuid(); lr uuid := gen_random_uuid(); ep uuid := gen_random_uuid(); ex uuid := gen_random_uuid();
  lc uuid := gen_random_uuid(); lcs uuid := gen_random_uuid(); ec uuid := gen_random_uuid(); ew uuid := gen_random_uuid(); ic uuid := gen_random_uuid();
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'no user to borrow'; end if;

  ---------------------------------------------------------------- (a) a non-card pair: the sibling's fee row is retired, a sibling left with only the fee is held
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, parsed_ok)
    values (la, u, 'sms', 't-' || la, 'confirmed', 'own_transfer', 105, 'EGP', 'bank leg test', now(), true),
           (ls, u, 'sms', 't-' || ls, 'paired', 'own_transfer', 100, 'EGP', 'wallet leg test', now(), true);
  update sms_parse_log set paired_log_id = ls where id = la;
  update sms_parse_log set paired_log_id = la where id = ls;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ea, u, 105, 'EGP', 'Transfer', current_date, 'Transfer test', la),
           (fee, u, 5, 'EGP', 'Other', current_date, 'Transfer fee', ls);
  update sms_parse_log set expense_id = ea where id = la;
  r := public.sms_discard_message(u, la);
  res := res || E'\n' || case when (select deleted_at is not null from expenses where id = fee) and (r->>'fee_rows_deleted')::int = 1 then 'PASS' else 'FAIL' end || ' (a) sibling fee row retired on a non-card pair';
  res := res || E'\n' || case when (select awaiting_confirmation and status = 'logged' and failure_code = 'pair_undone' from sms_parse_log where id = ls) and (r->>'sibling_held')::int = 1 then 'PASS' else 'FAIL' end || ' (a) sibling with only the fee is held';

  ---------------------------------------------------------------- (b) a placeholder the purchase retracted comes back when the purchase is discarded
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, parsed_ok)
    values (lp, u, 'sms', 't-' || lp, 'confirmed', 'purchase', 250, 'EGP', 'purchase test', now(), true),
           (lr, u, 'sms', 't-' || lr, 'confirmed', 'refund', 250, 'EGP', 'refund test', now(), true);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id, refunded_at, refund_kind, refund_sms_log_id)
    values (ep, u, 250, 'EGP', 'Other', current_date, 'Purchase test', lp, current_date, 'refunded', lr);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id, refunded_at, refund_kind, refund_sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (ex, u, 250, 'EGP', 'Other', current_date, 'Refund test', lr, current_date, 'refunded', lr, now(), lp);
  update sms_parse_log set expense_id = ep where id = lp;
  update sms_parse_log set expense_id = ep where id = lr;
  r := public.sms_discard_message(u, lp);
  res := res || E'\n' || case when (select deleted_at is null and retracted_by_sms_log_id is null from expenses where id = ex) then 'PASS' else 'FAIL' end || ' (b) placeholder restored, marker cleared';
  res := res || E'\n' || case when (select expense_id = ex from sms_parse_log where id = lr) and (r->>'refund_placeholders_restored')::int = 1 then 'PASS' else 'FAIL' end || ' (b) refund log repointed, counter';
  res := res || E'\n' || case when (select deleted_at is not null from expenses where id = ep) then 'PASS' else 'FAIL' end || ' (b) purchase row retired';

  ---------------------------------------------------------------- (c) a retracted income is not restored when the sibling's message already has a live expense
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, parsed_ok)
    values (lc, u, 'sms', 't-' || lc, 'confirmed', 'own_transfer', 100, 'EGP', 'bank leg test', now(), true),
           (lcs, u, 'sms', 't-' || lcs, 'paired', 'instant_transfer_in', 100, 'EGP', 'wallet credit test', now(), true);
  update sms_parse_log set paired_log_id = lcs where id = lc;
  update sms_parse_log set paired_log_id = lc where id = lcs;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ec, u, 100, 'EGP', 'Transfer', current_date, 'Transfer test', lc),
           (ew, u, 100, 'EGP', 'Transfer', current_date, 'Wallet top-up', lcs);
  insert into income_events (id, user_id, name, amount, currency, source_type, received_date, status, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (ic, u, 'Wallet credit test', 100, 'EGP', 'other', current_date, 'confirmed', lcs, now(), lc);
  perform public.sms_discard_message(u, lc);
  res := res || E'\n' || case when (select deleted_at is not null from income_events where id = ic) then 'PASS' else 'FAIL' end || ' (c) income stays retracted beside a live expense of the same message';

  raise exception 'ROLLBACK_OK %', res;
end $$;
