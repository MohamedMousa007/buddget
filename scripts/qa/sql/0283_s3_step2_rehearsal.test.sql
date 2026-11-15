-- S3b step 2 rehearsal (19 in-place rows: T4, T11, T5, T9, T8), rolled back. Needs sms_s3_input loaded and the 0283 functions.
-- Applies each type in a throwaway batch, checks the per-type totals against the prediction, the stale-push cases for the T11 and T4 rows,
-- reverts, checks the totals and the old category of the T4 expense are back, and always ends with an exception 'ROLLBACK_OK <lines>'.
do $$
declare
  res text := '';
  totals_sql constant text := $q$
    select left(user_id::text, 8) || '|' || currency::text || '|' || to_char(d, 'YYYY-MM') as k, round(sum(spend), 2) as spend, round(sum(income), 2) as income
    from (
      select user_id, currency, expense_date as d,
             case when refunded_at is null and spend_exclusion is null
                       and category::text not in ('Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange') then amount else 0 end as spend, 0::numeric as income
      from expenses where sms_log_id is not null and deleted_at is null
      union all
      select user_id, currency, received_date, 0, case when exclusion is null then amount else 0 end
      from income_events where sms_log_id is not null and deleted_at is null
    ) t group by 1 $q$;
  r record; p jsonb; out jsonb; expected jsonb; ids uuid[]; ty text; n int; bad int; rid uuid; tbl text; t_lid uuid; t_id uuid; rev0 int;
  b constant text := 's3test-step2';
  v_notif int; v_pushed int; v_signals int; v_discard int;
begin
  perform set_config('statement_timeout', '60000', true);
  create temp table s3_in on commit drop as
    select x.prefix, x.usr, x.rtype, x.ex, x.ins, x.eff,
           (select l.id from sms_parse_log l where l.id::text like x.prefix || '%' and left(l.user_id::text, 8) = x.usr) as lid
    from sms_s3_input x where x.step = 2 and x.rtype in ('T4', 'T11', 'T5', 'T9', 'T8');
  select count(*) into n from s3_in where lid is null;
  res := res || E'\n' || case when n = 0 and (select count(*) from s3_in) = 19 then 'PASS' else 'FAIL' end || ' (setup) 19 rows, all resolve (unresolved ' || n || ')';
  update s3_in set ex = ex || jsonb_build_object('marker_log', (select s.lid::text from s3_in s where s.prefix = s3_in.ex ->> 'marker_log'), 'pair_log', (select s.lid::text from s3_in s where s.prefix = s3_in.ex ->> 'pair_log'))
   where ex ? 'marker_log';
  -- the marker/pair log (42136093) is a T11 row of the same list
  select count(*) into n from s3_in where ex ? 'marker_log' and ex ->> 'marker_log' is null;
  res := res || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' (setup) the T9 marker log is in the list';

  select count(*) into v_notif from notifications;
  select count(*) filter (where pushed_at is not null) into v_pushed from sms_parse_log;
  select count(*) into v_signals from sms_template_signals;
  select count(*) filter (where discard_requested_at is not null) into v_discard from sms_parse_log;
  execute 'create temp table t_before on commit drop as ' || totals_sql;
  create temp table h_before on commit drop as
    select 'e' t, md5(to_jsonb(e)::text) h, id from expenses e where sms_log_id in (select lid from s3_in)
    union all select 'i', md5(to_jsonb(i)::text), id from income_events i where sms_log_id in (select lid from s3_in);

  -- a refusal on a T5 row: the live amount differs from the report
  select s.lid, s.ex into t_lid, p from s3_in s where s.prefix = '5fe0a498';
  out := sms_s3_apply('s3test-refuse2', 'T5', array[t_lid], jsonb_build_object(t_lid::text, p || jsonb_build_object('amount', 1)));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'amount_differs' and not exists (select 1 from sms_repair_audit where batch = 's3test-refuse2') then 'PASS' else 'FAIL ' || out::text end || ' (1) a differing amount is refused and writes no audit row';

  foreach ty in array array['T4', 'T11', 'T5', 'T9', 'T8'] loop
    select array_agg(lid order by prefix), jsonb_object_agg(lid::text, ex) into ids, expected from s3_in where rtype = ty;
    out := sms_s3_apply(b, ty, ids, expected);
    res := res || E'\n' || case when jsonb_array_length(out -> 'refused') = 0 and jsonb_array_length(out -> 'applied') = cardinality(ids) then 'PASS' else 'FAIL ' || out::text end
           || ' (2) ' || ty || ': applied ' || jsonb_array_length(out -> 'applied') || ' of ' || cardinality(ids);
  end loop;

  select count(*) into n from expenses e join s3_in s on s.lid = e.sms_log_id where s.prefix = '818b0736' and e.deleted_at is null and e.category::text = 'Transfer' and 'cash_deposit' = any (e.sms_flags);
  res := res || E'\n' || case when n = 1 then 'PASS' else 'FAIL' end || ' (2) 818b0736 is Transfer with cash_deposit';
  select count(*) into n from expenses e join s3_in s on s.lid = e.sms_log_id where s.rtype = 'T5' and e.deleted_at is null and e.category::text = 'CC Payoff' and e.sms_flags = array['card_load'];
  res := res || E'\n' || case when n = 7 then 'PASS' else 'FAIL ' || n end || ' (2) the 7 T5 rows carry exactly card_load, category unchanged';
  select count(*) into n from sms_repair_audit where batch = b;
  res := res || E'\n' || 'INFO (2) audit rows ' || n;

  execute 'create temp table t_after on commit drop as ' || totals_sql;
  create temp table t_pred on commit drop as
    select (s.usr || '|' || split_part(e.key, '|', 1) || '|' || split_part(e.key, '|', 2)) as k,
           sum(case when split_part(e.key, '|', 3) = 'spend' then e.value::numeric else 0 end) as spend,
           sum(case when split_part(e.key, '|', 3) = 'income' then e.value::numeric else 0 end) as income
    from s3_in s, jsonb_each_text(coalesce(s.eff, '{}'::jsonb)) e group by 1;
  select count(*) into bad from (select k from t_before union select k from t_after union select k from t_pred) keys
    where abs(coalesce((select spend from t_after a where a.k = keys.k), 0) - coalesce((select spend from t_before a where a.k = keys.k), 0) - coalesce((select spend from t_pred a where a.k = keys.k), 0)) > 0.005
       or abs(coalesce((select income from t_after a where a.k = keys.k), 0) - coalesce((select income from t_before a where a.k = keys.k), 0) - coalesce((select income from t_pred a where a.k = keys.k), 0)) > 0.005;
  res := res || E'\n' || case when bad = 0 then 'PASS' else 'FAIL' end || ' (3) totals after the apply equal before + the step 2 prediction (mismatching keys ' || bad || ')';

  -- stale push cannot undo the repairs; a later edit wins
  select s.lid into t_lid from s3_in s where s.prefix = '08ca4f8f';
  select id into t_id from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set category = 'Utilities', server_rev = 0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select category::text = 'Transfer' and 'topup_repaired' = any (sms_flags) from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4a) a stale push does not undo a repaired top-up';
  select s.lid into t_lid from s3_in s where s.prefix = '818b0736';
  select id into t_id from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set category = 'ATM Cash Withdrawal', sms_flags = null, server_rev = 0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select category::text = 'Transfer' and 'cash_deposit' = any (sms_flags) from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4b) a stale push does not undo the cash deposit retag or remove its flag';
  select s.lid into t_lid from s3_in s where s.prefix = '78e0b305';
  update income_events set deleted_at = null, edited_at = clock_timestamp() where sms_log_id = t_lid;
  res := res || E'\n' || case when (select deleted_at is not null from income_events where sms_log_id = t_lid) then 'PASS' else 'FAIL' end || ' (4c) a push cannot revive a retracted income';
  select s.lid into t_lid from s3_in s where s.prefix = '51966294';
  select id into t_id from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set sms_flags = null, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select 'card_load' = any (sms_flags) from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4d) a push cannot remove the card_load flag';
  select s.lid into t_lid from s3_in s where s.prefix = '8eb8cbf1';
  select id, server_rev into t_id, rev0 from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set category = 'Food', server_rev = rev0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select category::text = 'Food' from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4e) a later user edit wins over the repair';

  res := res || E'\n' || case when v_notif = (select count(*) from notifications) and v_pushed = (select count(*) filter (where pushed_at is not null) from sms_parse_log)
                              and v_signals = (select count(*) from sms_template_signals) and v_discard = (select count(*) filter (where discard_requested_at is not null) from sms_parse_log)
                         then 'PASS' else 'FAIL' end || ' (5) no notification, push stamp, template signal or discard request queued';

  out := sms_s3_revert(b);
  res := res || E'\n' || 'INFO (6) revert: ' || (out ->> 'reverted') || ' restored, skipped ' || (out -> 'skipped')::text;
  res := res || E'\n' || case when jsonb_array_length(out -> 'skipped') <= 1 then 'PASS' else 'FAIL' end || ' (6) only the user-edited row (8eb8cbf1) is skipped';
  execute 'create temp table t_rev on commit drop as ' || totals_sql;
  select count(*) into bad from (select k from t_before union select k from t_rev) keys
   where coalesce((select spend from t_rev a where a.k = keys.k), 0) <> coalesce((select spend from t_before a where a.k = keys.k), 0)
      or coalesce((select income from t_rev a where a.k = keys.k), 0) <> coalesce((select income from t_before a where a.k = keys.k), 0);
  res := res || E'\n' || case when bad = 0 then 'PASS' else 'FAIL ' || bad end || ' (6) totals after the revert equal the starting totals (the user-edited row stays Food, which is spending as before)';
  create temp table h_after on commit drop as
    select 'e' t, md5(to_jsonb(e)::text) h, id from expenses e where sms_log_id in (select lid from s3_in)
    union all select 'i', md5(to_jsonb(i)::text), id from income_events i where sms_log_id in (select lid from s3_in);
  select count(*) into n from (select id from h_before except select id from (select b2.id from h_before b2 join h_after a using (id, h)) q) d;
  res := res || E'\n' || 'INFO (6) rows whose full content differs from the start after the revert (server_rev, edits, expected for the edited row): ' || n;
  select count(*) into n from expenses e join s3_in s on s.lid = e.sms_log_id where s.prefix = '818b0736' and e.deleted_at is null and e.category::text = 'ATM Cash Withdrawal' and not ('cash_deposit' = any (coalesce(e.sms_flags, '{}')));
  res := res || E'\n' || case when n = 1 then 'PASS' else 'FAIL' end || ' (6) 818b0736 is back to ATM Cash Withdrawal without the flag';
  select count(*) into n from income_events i join s3_in s on s.lid = i.sms_log_id where s.rtype in ('T4', 'T8', 'T9') and s.ex ->> 'table' = 'income_events' and i.deleted_at is null;
  res := res || E'\n' || case when n = 6 then 'PASS' else 'FAIL ' || n end || ' (6) the 6 retracted incomes are live again';
  select count(*) into n from sms_parse_log where discard_requested_at is not null;
  res := res || E'\n' || case when n = v_discard then 'PASS' else 'FAIL' end || ' (6) the revert queued no discard';

  raise exception 'ROLLBACK_OK %', res;
end $$;
