-- Paste into the SQL console AFTER migration 0275 is applied (it lives here, not in supabase/migrations, because the migration check scans that folder). Inserts synthetic rows for an existing user, runs the
-- scenarios, and always ends with an exception ('ROLLBACK_OK <result>') so nothing persists. Read the text after
-- ROLLBACK_OK: every line is PASS or FAIL. A different error text means a scenario setup or the function itself failed.
do $$
declare
  u uuid;
  res text := '';
  lr uuid; p uuid;
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'no user to borrow'; end if;

  ---------------------------------------------------------------- (a) I8: a client write cannot change refunded_amount
  lr := gen_random_uuid(); p := gen_random_uuid();
  insert into sms_parse_log (id, user_id, source, sms_hash, status, kind, amount, currency, raw_body, received_at)
    values (lr, u, 'sms', 't-' || lr, 'confirmed', 'refund', 30, 'EGP', 'refund test', now());
  insert into expenses (id, user_id, amount, currency, category, expense_date, description, refunded_amount, refund_sms_log_id)
    values (p, u, 100, 'EGP', 'Other', current_date, 'Purchase test', 30, lr);
  update expenses set refunded_amount = null, description = 'edited', edited_at = clock_timestamp() where id = p;
  res := res || E'\n' || case when (select refunded_amount = 30 and refund_sms_log_id = lr and description = 'edited' from expenses where id = p) then 'PASS' else 'FAIL' end || ' (a) client write keeps refunded_amount, other columns change';
  update expenses set refunded_amount = 99 where id = p;
  res := res || E'\n' || case when (select refunded_amount = 99 from expenses where id = p) then 'PASS' else 'FAIL' end || ' (a) a server write (edited_at untouched) can set it';
  update expenses set refunded_amount = 30 where id = p;

  ---------------------------------------------------------------- (b) I1: discarding the refund message clears the partial stamp
  perform public.sms_discard_message(u, lr);
  res := res || E'\n' || case when (select refunded_amount is null and refund_sms_log_id is null and refunded_at is null and refund_kind is null from expenses where id = p) then 'PASS' else 'FAIL' end || ' (b) discard clears the partial stamp';

  raise exception 'ROLLBACK_OK %', res;
end $$;
