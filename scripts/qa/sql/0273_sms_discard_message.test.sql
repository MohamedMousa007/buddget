-- Paste into the SQL console AFTER migration 0273 is applied (it lives here, not in supabase/migrations, because the migration check scans that folder). Inserts synthetic rows for an existing user, runs the
-- scenarios, and always ends with an exception ('ROLLBACK_OK <result>') so nothing persists. Read the text after
-- ROLLBACK_OK: every line is PASS or FAIL. A different error text means a scenario setup or the function itself failed.
do $$
declare
  u uuid;
  res text := '';
  r jsonb;
  l1 uuid; l2 uuid; lp uuid; lf uuid; lr uuid; lb uuid; lh uuid;
  e1 uuid; i2 uuid; ep uuid; ef uuid; ef1 uuid; dp uuid; d uuid; p uuid; ph uuid;
  t1 timestamptz; t2 timestamptz;
  n int;
  lx uuid; ex uuid; ix uuid; ly uuid; ey uuid; iy uuid; lz uuid; ez uuid; iz uuid;
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'no user to borrow'; end if;

  ---------------------------------------------------------------- (a) out leg then in leg settled; discard the out leg
  l1 := gen_random_uuid(); l2 := gen_random_uuid(); e1 := gen_random_uuid(); i2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l1, u, 'sms', 't-' || l1, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'IPN transfer test', now(), 'settle');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l2, u, 'sms', 't-' || l2, 'paired', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), 'settle');
  update sms_parse_log set paired_log_id = l2 where id = l1;
  update sms_parse_log set paired_log_id = l1 where id = l2;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (e1, u, 500, 'EGP', 'Transfer', current_date, 'Transfer test', l1);
  update sms_parse_log set expense_id = e1 where id = l1;
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (i2, u, 'Bank credit', 500, 'EGP', current_date, l2, now(), l1);

  r := public.sms_discard_message(u, l1);
  res := res || E'\n' || case when (select deleted_at is null and retracted_by_sms_log_id is null from income_events where id = i2) then 'PASS' else 'FAIL' end || ' (a) income restored, marker cleared';
  res := res || E'\n' || case when not exists (select 1 from expenses where sms_log_id in (l1, l2) and deleted_at is null and category = 'Transfer') then 'PASS' else 'FAIL' end || ' (a) no live Transfer row';
  res := res || E'\n' || case when (select paired_log_id is null and status = 'undone' and expense_id is null from sms_parse_log where id = l1)
                                and (select paired_log_id is null and status = 'confirmed' and income_id = i2 from sms_parse_log where id = l2) then 'PASS' else 'FAIL' end || ' (a) logs unpaired, sibling relinked';
  res := res || E'\n' || case when (select own_transfer_verdict = 'undone' from sms_parse_log where id = l1) then 'PASS' else 'FAIL' end || ' (a) verdict undone';

  ---------------------------------------------------------------- (g) a second call changes nothing
  select updated_at into t1 from income_events where id = i2;
  select updated_at into t2 from expenses where id = e1;
  r := public.sms_discard_message(u, l1);
  res := res || E'\n' || case when (r ->> 'nothing_to_do') = 'true'
                                and (select updated_at = t1 from income_events where id = i2)
                                and (select updated_at = t2 from expenses where id = e1) then 'PASS' else 'FAIL' end || ' (g) second discard is a no-op';
  -- the early return: an undone log is left alone even if the user re-created a row for it
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (gen_random_uuid(), u, 5, 'EGP', 'Other', current_date, 'Recreated test', l1);
  r := public.sms_discard_message(u, l1);
  res := res || E'\n' || case when (r ->> 'nothing_to_do') = 'true'
                                and exists (select 1 from expenses where sms_log_id = l1 and description = 'Recreated test' and deleted_at is null) then 'PASS' else 'FAIL' end || ' (g) undone log returns early, re-created row kept';
  res := res || E'\n' || case when (select parsed_ok = false from sms_parse_log where id = l1) then 'PASS' else 'FAIL' end || ' (g) discarded log is no longer claimable';

  ---------------------------------------------------------------- (b) the user deleted the income themselves (no marker)
  l1 := gen_random_uuid(); l2 := gen_random_uuid(); e1 := gen_random_uuid(); i2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l1, u, 'sms', 't-' || l1, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'transfer test', now(), 'settle');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l2, u, 'sms', 't-' || l2, 'paired', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), 'settle');
  update sms_parse_log set paired_log_id = l2 where id = l1;
  update sms_parse_log set paired_log_id = l1 where id = l2;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (e1, u, 500, 'EGP', 'Transfer', current_date, 'Transfer test', l1);
  update sms_parse_log set expense_id = e1 where id = l1;
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (i2, u, 'Bank credit', 500, 'EGP', current_date, l2, now(), null);
  r := public.sms_discard_message(u, l1);
  res := res || E'\n' || case when (select deleted_at is not null and retracted_by_sms_log_id is null from income_events where id = i2) then 'PASS' else 'FAIL' end || ' (b) user-deleted income stays deleted';
  res := res || E'\n' || case when (select category = 'Remittance' from expenses where id = e1) or (select deleted_at is not null from expenses where id = e1) then 'PASS' else 'FAIL' end || ' (b) transfer row retired';
  res := res || E'\n' || case when (select paired_log_id is null from sms_parse_log where id = l2) then 'PASS' else 'FAIL' end || ' (b) logs unpaired';

  ---------------------------------------------------------------- (c) funding leg + repayment with a fee row; discard the repayment
  lp := gen_random_uuid(); lf := gen_random_uuid(); d := gen_random_uuid(); dp := gen_random_uuid();
  ep := gen_random_uuid(); ef := gen_random_uuid(); ef1 := gen_random_uuid();
  insert into debts (id, user_id, name, amount, starting_balance, debt_type, direction, status, cleared_at)
    values (d, u, 'Test loan', 1000, 1000, 'loan', 'i_owe', 'cleared', current_date::timestamptz);
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (lp, u, 'sms', 't-' || lp, 'confirmed', 'cc_payoff', 1000, 'EGP', 'repayment test', now()),
           (lf, u, 'sms', 't-' || lf, 'paired', 'own_transfer', 1012, 'EGP', 'funding test', now());
  insert into debt_payments (id, user_id, debt_id, amount, currency, payment_date, sms_log_id)
    values (dp, u, d, 1000, 'EGP', current_date, lp);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id, is_debt_payment, linked_debt_id, linked_debt_payment_id)
    values (ep, u, 1000, 'EGP', 'CC Payoff', current_date, 'Repayment test', lp, true, d, dp);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ef, u, 12, 'EGP', 'Other', current_date, 'Transfer fee', lp);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (ef1, u, 1012, 'EGP', 'Transfer', current_date, 'Funding test', lf, now(), lp);
  update sms_parse_log set paired_log_id = lf, expense_id = ep, debt_payment_id = dp where id = lp;
  update sms_parse_log set paired_log_id = lp where id = lf;

  r := public.sms_discard_message(u, lp);
  res := res || E'\n' || case when (select count(*) = 0 from expenses where id in (ep, ef) and deleted_at is null)
                                and (select deleted_at is not null from debt_payments where id = dp) then 'PASS' else 'FAIL' end || ' (c) repayment, fee row and debt payment retired';
  res := res || E'\n' || case when (select status = 'active' and cleared_at is null from debts where id = d) then 'PASS' else 'FAIL' end || ' (c) cleared debt reopened';
  res := res || E'\n' || case when (select deleted_at is null and retracted_by_sms_log_id is null from expenses where id = ef1)
                                and (select expense_id = ef1 and paired_log_id is null and status = 'confirmed' from sms_parse_log where id = lf)
                                and (select paired_log_id is null and status = 'undone' from sms_parse_log where id = lp) then 'PASS' else 'FAIL' end || ' (c) funding row restored, logs unpaired';

  ---------------------------------------------------------------- (d) a refund message that stamped a purchase
  lr := gen_random_uuid(); p := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (lr, u, 'sms', 't-' || lr, 'confirmed', 'refund', 80, 'EGP', 'refund test', now());
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, refunded_at, refund_kind, refund_sms_log_id)
    values (p, u, 80, 'EGP', 'Other', current_date, 'Purchase test', now(), 'refunded', lr);
  r := public.sms_discard_message(u, lr);
  res := res || E'\n' || case when (select refunded_at is null and refund_kind is null and refund_sms_log_id is null and deleted_at is null from expenses where id = p) then 'PASS' else 'FAIL' end || ' (d) refund stamp cleared, purchase kept';

  ---------------------------------------------------------------- (e) app-style delete only records a request; the job then discards
  l1 := gen_random_uuid(); l2 := gen_random_uuid(); e1 := gen_random_uuid(); i2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l1, u, 'sms', 't-' || l1, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'IPN transfer test', now(), 'settle');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (l2, u, 'sms', 't-' || l2, 'paired', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), 'settle');
  update sms_parse_log set paired_log_id = l2 where id = l1;
  update sms_parse_log set paired_log_id = l1 where id = l2;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (e1, u, 500, 'EGP', 'Transfer', current_date, 'Transfer test', l1);
  update sms_parse_log set expense_id = e1 where id = l1;
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (i2, u, 'Bank credit', 500, 'EGP', current_date, l2, now(), l1);
  update expenses set deleted_at = now() where id = e1;
  res := res || E'\n' || case when (select discard_requested_at is not null and status = 'confirmed' and paired_log_id = l2 from sms_parse_log where id = l1)
                                and (select deleted_at is not null from income_events where id = i2) then 'PASS' else 'FAIL' end || ' (e) delete set the request and changed nothing else';
  update sms_parse_log set discard_requested_at = now() - interval '1 minute' where id = l1;
  n := public.sms_run_pending_discards();
  res := res || E'\n' || case when n >= 1 and (select deleted_at is null and retracted_by_sms_log_id is null from income_events where id = i2) then 'PASS' else 'FAIL' end || ' (e) job restored the income';
  res := res || E'\n' || case when (select paired_log_id is null and status = 'undone' and discard_requested_at is null from sms_parse_log where id = l1)
                                and (select paired_log_id is null and status = 'confirmed' and income_id = i2 from sms_parse_log where id = l2) then 'PASS' else 'FAIL' end || ' (e) end state matches (a)';

  ---------------------------------------------------------------- (e2) delete, then revive within the Undo window
  lx := gen_random_uuid(); ly := gen_random_uuid(); ex := gen_random_uuid(); ix := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (lx, u, 'sms', 't-' || lx, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'IPN transfer test', now(), 'settle');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (ly, u, 'sms', 't-' || ly, 'paired', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), 'settle');
  update sms_parse_log set paired_log_id = ly where id = lx;
  update sms_parse_log set paired_log_id = lx where id = ly;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ex, u, 500, 'EGP', 'Transfer', current_date, 'Transfer test', lx);
  update sms_parse_log set expense_id = ex where id = lx;
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (ix, u, 'Bank credit', 500, 'EGP', current_date, ly, now(), lx);
  update expenses set deleted_at = now() where id = ex;
  update expenses set deleted_at = null where id = ex;
  update sms_parse_log set discard_requested_at = now() - interval '1 minute' where id = lx;
  n := public.sms_run_pending_discards();
  res := res || E'\n' || case when (select discard_requested_at is null from sms_parse_log where id = lx) then 'PASS' else 'FAIL' end || ' (e2) revive cleared the request';
  res := res || E'\n' || case when (select status = 'confirmed' and paired_log_id = ly from sms_parse_log where id = lx)
                                and (select deleted_at is not null from income_events where id = ix) then 'PASS' else 'FAIL' end || ' (e2) pair intact, nothing discarded';

  ---------------------------------------------------------------- (e3) a request younger than 30 seconds is left for later
  lz := gen_random_uuid(); ly := gen_random_uuid(); ez := gen_random_uuid(); iz := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (lz, u, 'sms', 't-' || lz, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'IPN transfer test', now(), 'settle');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, own_transfer_verdict)
    values (ly, u, 'sms', 't-' || ly, 'paired', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), 'settle');
  update sms_parse_log set paired_log_id = ly where id = lz;
  update sms_parse_log set paired_log_id = lz where id = ly;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ez, u, 500, 'EGP', 'Transfer', current_date, 'Transfer test', lz);
  update sms_parse_log set expense_id = ez where id = lz;
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id, deleted_at, retracted_by_sms_log_id)
    values (iz, u, 'Bank credit', 500, 'EGP', current_date, ly, now(), lz);
  update expenses set deleted_at = now() where id = ez;
  perform public.sms_run_pending_discards();
  res := res || E'\n' || case when (select discard_requested_at is not null and status = 'confirmed' from sms_parse_log where id = lz) then 'PASS' else 'FAIL' end || ' (e3) young request left in place';

  ---------------------------------------------------------------- (f) a pipeline retraction does not fire it
  l1 := gen_random_uuid(); l2 := gen_random_uuid(); i2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, income_id)
    values (l1, u, 'sms', 't-' || l1, 'confirmed', 'instant_transfer_out', 500, 'EGP', 'transfer test', now(), null),
           (l2, u, 'sms', 't-' || l2, 'confirmed', 'instant_transfer_in', 500, 'EGP', 'credit test', now(), null);
  insert into income_events (id, user_id, name, amount, currency, received_date, sms_log_id)
    values (i2, u, 'Bank credit', 500, 'EGP', current_date, l2);
  update sms_parse_log set income_id = i2 where id = l2;
  update income_events set deleted_at = now(), retracted_by_sms_log_id = l1 where id = i2;
  res := res || E'\n' || case when (select status = 'confirmed' and income_id = i2 from sms_parse_log where id = l2) then 'PASS' else 'FAIL' end || ' (f) pipeline retraction left the log alone';

  ---------------------------------------------------------------- (h) the refund placeholder deleted with no marker
  lh := gen_random_uuid(); p := gen_random_uuid(); ph := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (lh, u, 'sms', 't-' || lh, 'confirmed', 'refund', 80, 'EGP', 'refund test', now());
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, refunded_at, refund_kind, refund_sms_log_id)
    values (p, u, 80, 'EGP', 'Other', current_date, 'Purchase test', now(), 'refunded', lh);
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id, refunded_at, refund_kind, sms_flags)
    values (ph, u, 80, 'EGP', 'Other', current_date, 'Refund placeholder test', lh, now(), 'refunded', array['refund_unmatched']);
  update expenses set deleted_at = now() where id = ph;
  res := res || E'\n' || case when (select refund_sms_log_id = lh and refunded_at is not null from expenses where id = p) then 'PASS' else 'FAIL' end || ' (h) placeholder delete keeps the stamp on the purchase';

  raise exception 'ROLLBACK_OK %', res;
end $$;
