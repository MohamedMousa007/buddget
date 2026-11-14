-- Paste into the SQL console AFTER migration 0279 is applied (it lives here, not in supabase/migrations, because the migration check scans that folder). Same shape as 0273's test: synthetic rows for an existing user, always ends with an exception ('ROLLBACK_OK <result>') so nothing persists. Every result line is PASS or FAIL.
do $$
declare
  u uuid;
  res text := '';
  r jsonb;
  la uuid; d uuid; dp uuid; sa uuid; st uuid; st2 uuid; dp2 uuid;
  lc uuid; lcs uuid; lc2 uuid; lcs2 uuid; ec2 uuid; ecs2 uuid;
  bal numeric;
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'no user to borrow'; end if;

  ---------------------------------------------------------------- (A) a pocket-funded debt payment takes its withdrawal with it
  la := gen_random_uuid(); d := gen_random_uuid(); dp := gen_random_uuid(); sa := gen_random_uuid(); st := gen_random_uuid();
  insert into savings_accounts (id, user_id, name, current_balance) values (sa, u, 'Test pocket', 1000);
  insert into savings_transactions (id, user_id, account_id, amount, kind) values (st, u, sa, 100, 'withdrawal');
  select current_balance into bal from savings_accounts where id = sa;
  res := res || E'\n' || case when bal = 900 then 'PASS' else 'FAIL' end || ' (A) setup: withdrawal took 100 from the pocket (needs savings_balance_delta_enabled)';
  insert into debts (id, user_id, name, amount, starting_balance, debt_type, direction, status)
    values (d, u, 'Test loan', 1000, 1000, 'loan', 'i_owe', 'active');
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (la, u, 'sms', 't-' || la, 'confirmed', 'installment_payment', 100, 'EGP', 'repayment test', now());
  insert into debt_payments (id, user_id, debt_id, amount, currency, payment_date, sms_log_id, funded_from_savings, funded_from_savings_tx_id)
    values (dp, u, d, 100, 'EGP', current_date, la, true, st);
  update sms_parse_log set debt_payment_id = dp where id = la;

  r := public.sms_discard_message(u, la);
  res := res || E'\n' || case when (select deleted_at is not null from debt_payments where id = dp) then 'PASS' else 'FAIL' end || ' (A) payment retired';
  res := res || E'\n' || case when (select deleted_at is not null from savings_transactions where id = st) then 'PASS' else 'FAIL' end || ' (A) withdrawal soft-deleted';
  select current_balance into bal from savings_accounts where id = sa;
  res := res || E'\n' || case when bal = 1000 then 'PASS' else 'FAIL' end || ' (A) pocket balance returned';
  res := res || E'\n' || case when (r->>'savings_withdrawals_reversed')::int = 1 then 'PASS' else 'FAIL' end || ' (A) counter';

  r := public.sms_discard_message(u, la);
  select current_balance into bal from savings_accounts where id = sa;
  res := res || E'\n' || case when bal = 1000 and (r->>'nothing_to_do')::boolean then 'PASS' else 'FAIL' end || ' (A) second call changes nothing';

  ---------------------------------------------------------------- (A2) a withdrawal another live payment still points at is kept
  st2 := gen_random_uuid(); dp2 := gen_random_uuid();
  insert into savings_transactions (id, user_id, account_id, amount, kind) values (st2, u, sa, 50, 'withdrawal');
  la := gen_random_uuid(); dp := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (la, u, 'sms', 't-' || la, 'confirmed', 'installment_payment', 50, 'EGP', 'repayment test', now());
  insert into debt_payments (id, user_id, debt_id, amount, currency, payment_date, sms_log_id, funded_from_savings, funded_from_savings_tx_id)
    values (dp, u, d, 50, 'EGP', current_date, la, true, st2),
           (dp2, u, d, 50, 'EGP', current_date, null, true, st2);
  update sms_parse_log set debt_payment_id = dp where id = la;
  perform public.sms_discard_message(u, la);
  res := res || E'\n' || case when (select deleted_at is null from savings_transactions where id = st2) then 'PASS' else 'FAIL' end || ' (A2) shared withdrawal kept';

  ---------------------------------------------------------------- (C) a sibling with no row of its own is held, not left confirmed
  lc := gen_random_uuid(); lcs := gen_random_uuid(); ec2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, parsed_ok)
    values (lc, u, 'sms', 't-' || lc, 'confirmed', 'instant_transfer_out', 300, 'EGP', 'transfer out test', now(), true),
           (lcs, u, 'sms', 't-' || lcs, 'paired', 'instant_transfer_in', 300, 'EGP', 'credit test', now(), true);
  update sms_parse_log set paired_log_id = lcs where id = lc;
  update sms_parse_log set paired_log_id = lc where id = lcs;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ec2, u, 300, 'EGP', 'Transfer', current_date, 'Transfer test', lc);
  update sms_parse_log set expense_id = ec2 where id = lc;

  r := public.sms_discard_message(u, lc);
  res := res || E'\n' || case when (select awaiting_confirmation and parsed_ok and status = 'logged' and failure_code = 'pair_undone'
                                           and paired_log_id is null and expense_id is null and income_id is null and debt_payment_id is null
                                      from sms_parse_log where id = lcs) then 'PASS' else 'FAIL' end || ' (C) sibling held';
  res := res || E'\n' || case when (r->>'sibling_held')::int = 1 then 'PASS' else 'FAIL' end || ' (C) counter';

  ---------------------------------------------------------------- (C2) a sibling that has a live row stays confirmed
  lc2 := gen_random_uuid(); lcs2 := gen_random_uuid(); ecs2 := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at, parsed_ok)
    values (lc2, u, 'sms', 't-' || lc2, 'confirmed', 'instant_transfer_out', 70, 'EGP', 'transfer out test', now(), true),
           (lcs2, u, 'sms', 't-' || lcs2, 'paired', 'instant_transfer_out', 70, 'EGP', 'transfer out test two', now(), true);
  update sms_parse_log set paired_log_id = lcs2 where id = lc2;
  update sms_parse_log set paired_log_id = lc2 where id = lcs2;
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, sms_log_id)
    values (ecs2, u, 70, 'EGP', 'Remittance', current_date, 'Sibling row test', lcs2);
  update sms_parse_log set expense_id = ecs2 where id = lcs2;
  perform public.sms_discard_message(u, lc2);
  res := res || E'\n' || case when (select status = 'confirmed' and not awaiting_confirmation and failure_code is null from sms_parse_log where id = lcs2) then 'PASS' else 'FAIL' end || ' (C2) sibling with a row stays confirmed';

  raise exception 'ROLLBACK_OK %', res;
end $$;
