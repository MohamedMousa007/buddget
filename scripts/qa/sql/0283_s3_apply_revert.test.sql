-- S3b phase B: the rolled-back rehearsal of the whole repair on the live database (docs/launch/S3b-apply.md).
-- GENERATED from this template by scripts/qa/s3-gen-apply-input.py: scripts/qa/sql/0283_s3_apply_revert.test.sql. Needs the list loaded first (scripts/qa/sql/0283_s3_load_input.sql).
-- Paste into the SQL console AFTER migration 0283. It applies every repair of the list (inserts are simulated by direct inserts that
-- carry the proposed row, then audited with sms_s3_record_insert: the real booking function is exercised by scripts/qa/s3-insert.ts),
-- checks, reverts, checks, and always ends with an exception 'ROLLBACK_OK <result>' so nothing persists. Every line of the text is
-- PASS, FAIL or INFO. A different error text means the setup or a function itself failed.
do $$
declare
  res text := '';
  totals_sql constant text := $q$
    select left(user_id::text, 8) || '|' || currency::text || '|' || to_char(d, 'YYYY-MM') as k, round(sum(spend), 2) as spend, round(sum(income), 2) as income
    from (
      select user_id, currency, expense_date as d,
             case when refunded_at is null and spend_exclusion is null
                       and category::text not in ('Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange') then amount else 0 end as spend,
             0::numeric as income
      from expenses where sms_log_id is not null and deleted_at is null
      union all
      select user_id, currency, received_date, 0, case when exclusion is null then amount else 0 end
      from income_events where sms_log_id is not null and deleted_at is null
    ) t group by 1 $q$;
  r record; p jsonb; vex jsonb; rid uuid; tbl text; out jsonb; expected jsonb; ids uuid[]; ty text; n int; n2 int; bad int;
  b constant text := 's3test-main'; b2 constant text := 's3test-second';
  v_notif int; v_pushed int; v_signals int; v_discard int; v_notif2 int; v_pushed2 int; v_signals2 int; v_discard2 int;
  t_lid uuid; t_id uuid; rev0 int;
begin
  ---------------------------------------------------------------- setup: resolve the 8-character ids against the live log
  create temp table s3_in on commit drop as
    select x.prefix, x.usr, x.rtype, x.step, x.ex, x.ins, x.eff,
           (select l.id from sms_parse_log l where l.id::text like x.prefix || '%' and left(l.user_id::text, 8) = x.usr) as lid
    from sms_s3_input x;
  select count(*) into n from s3_in where lid is null;
  res := res || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' (setup) every id resolves to one live log (' || (select count(*) from s3_in) || ' rows, unresolved ' || n || ')';
  update s3_in set ex = ex || jsonb_build_object('stamp_from_log', (select s.lid::text from s3_in s where s.prefix = s3_in.ex ->> 'stamp_from_log'))
   where ex ? 'stamp_from_log';
  update s3_in set ex = ex || jsonb_build_object('marker_log', (select s.lid::text from s3_in s where s.prefix = s3_in.ex ->> 'marker_log'),
                                                 'pair_log', (select s.lid::text from s3_in s where s.prefix = s3_in.ex ->> 'pair_log'))
   where ex ? 'marker_log';

  select count(*) into v_notif from notifications;
  select count(*) filter (where pushed_at is not null) into v_pushed from sms_parse_log;
  select count(*) into v_signals from sms_template_signals;
  select count(*) filter (where discard_requested_at is not null) into v_discard from sms_parse_log;
  execute 'create temp table t_before on commit drop as ' || totals_sql;
  create temp table flags_before on commit drop as
    select left(user_id::text, 8) u8, unnest(sms_flags) f from expenses where sms_log_id is not null and deleted_at is null and sms_flags is not null
    union all select left(user_id::text, 8), unnest(sms_flags) from income_events where sms_log_id is not null and deleted_at is null and sms_flags is not null;

  ---------------------------------------------------------------- (1) refusals: a user-touched row, a deleted row, a changed value
  select s.lid, s.ex into t_lid, vex from s3_in s where s.prefix = '737c4e4c';
  select id into t_id from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set notes = 'touched' where id = t_id;
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'user_notes' and jsonb_array_length(out -> 'applied') = 0 then 'PASS' else 'FAIL ' || out::text end || ' (1a) a row with a note is refused';
  update expenses set notes = null where id = t_id;
  update expenses set sms_flags_ack = array['possible_duplicate'] where id = t_id;
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'user_flag_answer' then 'PASS' else 'FAIL ' || out::text end || ' (1b) a row with an answered flag is refused';
  update expenses set sms_flags_ack = null where id = t_id;
  update expenses set spend_exclusion = 'manual' where id = t_id;
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'user_exclusion' then 'PASS' else 'FAIL ' || out::text end || ' (1c) an excluded row is refused';
  update expenses set spend_exclusion = null where id = t_id;
  update expenses set deleted_at = now() where id = t_id;
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'no_live_row' then 'PASS' else 'FAIL ' || out::text end || ' (1d) a row the user deleted is never touched';
  update expenses set deleted_at = null where id = t_id;
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex || jsonb_build_object('amount', (vex ->> 'amount')::numeric + 1)));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'amount_differs' then 'PASS' else 'FAIL ' || out::text end || ' (1e) a live amount that differs from the report is refused';
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex || jsonb_build_object('day', '2020-01-01')));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'day_differs' then 'PASS' else 'FAIL ' || out::text end || ' (1f) a live day that differs from the report is refused';
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex || jsonb_build_object('category', 'Food')));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'category_differs' then 'PASS' else 'FAIL ' || out::text end || ' (1g) a live category that differs from the report is refused';
  out := sms_s3_apply('s3test-refuse', 'T15', array[t_lid], jsonb_build_object(t_lid::text, vex || jsonb_build_object('new_day', '2030-02-01')));
  res := res || E'\n' || case when out #>> '{refused,0,reason}' = 'day_shift_crosses_month' then 'PASS' else 'FAIL ' || out::text end || ' (1h) a day shift across a month is refused';
  select count(*) into n from sms_repair_audit where batch = 's3test-refuse';
  res := res || E'\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' (1i) a refusal writes no audit row and changes nothing';

  ---------------------------------------------------------------- (2) the whole batch, in the order of part 7
  foreach ty in array array['T3', 'T4', 'T1', 'T2a', 'T2b', 'T8', 'T9', 'T11', 'T5', 'T15'] loop
    select array_agg(lid order by prefix), jsonb_object_agg(lid::text, ex) into ids, expected from s3_in where rtype = ty and ex is not null;
    out := sms_s3_apply(b, ty, ids, expected);
    res := res || E'\n' || case when jsonb_array_length(out -> 'refused') = 0 and jsonb_array_length(out -> 'applied') = cardinality(ids) then 'PASS' else 'FAIL ' || out::text end
           || ' (2) ' || ty || ': applied ' || jsonb_array_length(out -> 'applied') || ' of ' || cardinality(ids);
    -- inserts that follow the retraction of this type's rows
    for r in select * from s3_in where ins is not null and rtype = ty loop
      p := r.ins;
      if p ->> 't' = 'I' then
        insert into income_events (user_id, name, amount, currency, source_type, received_date, status, sms_log_id, sms_flags)
        select u.user_id, 's3 sim', (p ->> 'amt')::numeric, (p ->> 'ccy')::currency_code, 'other', (p ->> 'day')::date, 'confirmed', r.lid,
               case when jsonb_array_length(p -> 'flags') > 0 then array(select jsonb_array_elements_text(p -> 'flags')) end
        from sms_parse_log u where u.id = r.lid returning id into rid;
        tbl := 'income_events';
      else
        insert into expenses (user_id, description, category, amount, currency, expense_date, sms_log_id, sms_flags, refunded_at, refund_kind, refund_sms_log_id)
        select u.user_id, 's3 sim', (p ->> 'cat')::expense_category, (p ->> 'amt')::numeric, (p ->> 'ccy')::currency_code, (p ->> 'day')::date, r.lid,
               case when jsonb_array_length(p -> 'flags') > 0 then array(select jsonb_array_elements_text(p -> 'flags')) end,
               case when p ->> 'cls' = 'netzero' then now() end, p -> 'refund' ->> 0, case when p ->> 'cls' = 'netzero' then r.lid end
        from sms_parse_log u where u.id = r.lid returning id into rid;
        tbl := 'expenses';
      end if;
      perform sms_s3_record_insert(b, r.rtype, r.lid, tbl, rid);
    end loop;
  end loop;
  -- the types that only insert
  for r in select * from s3_in where ins is not null and ex is null loop
    p := r.ins;
    if p ->> 't' = 'I' then
      insert into income_events (user_id, name, amount, currency, source_type, received_date, status, sms_log_id)
      select u.user_id, 's3 sim', (p ->> 'amt')::numeric, (p ->> 'ccy')::currency_code, 'other', (p ->> 'day')::date, 'confirmed', r.lid from sms_parse_log u where u.id = r.lid returning id into rid;
      tbl := 'income_events';
    else
      insert into expenses (user_id, description, category, amount, currency, expense_date, sms_log_id, sms_flags, refunded_at, refund_kind, refund_sms_log_id)
      select u.user_id, 's3 sim', (p ->> 'cat')::expense_category, (p ->> 'amt')::numeric, (p ->> 'ccy')::currency_code, (p ->> 'day')::date, r.lid,
             case when jsonb_array_length(p -> 'flags') > 0 then array(select jsonb_array_elements_text(p -> 'flags')) end,
             case when p ->> 'cls' = 'netzero' then now() end, p -> 'refund' ->> 0, case when p ->> 'cls' = 'netzero' then r.lid end
      from sms_parse_log u where u.id = r.lid returning id into rid;
      tbl := 'expenses';
    end if;
    perform sms_s3_record_insert(b, r.rtype, r.lid, tbl, rid);
  end loop;
  select count(*) into n from sms_repair_audit where batch = b and action <> 'relink';
  select count(*) into n2 from s3_in;
  res := res || E'\n' || case when n = n2 + (select count(*) from s3_in where ex is not null and ins is not null) then 'PASS' else 'FAIL' end
         || ' (2) audit rows ' || n || ' for ' || n2 || ' list rows (a deposit or unmatched refund has a retraction and an insert)';
  out := sms_s3_apply(b, 'T15', (select array_agg(lid) from s3_in where rtype = 'T15'), (select jsonb_object_agg(lid::text, ex) from s3_in where rtype = 'T15'));
  res := res || E'\n' || case when jsonb_array_length(out -> 'applied') = 0 and jsonb_array_length(out -> 'refused') = (select count(*) from s3_in where rtype = 'T15') then 'PASS' else 'FAIL' end || ' (2) a second call of the same batch applies nothing (idempotent)';

  ---------------------------------------------------------------- (3) totals after the apply equal the report's prediction
  execute 'create temp table t_after on commit drop as ' || totals_sql;
  create temp table t_pred on commit drop as
    select (s.usr || '|' || split_part(e.key, '|', 1) || '|' || split_part(e.key, '|', 2)) as k,
           sum(case when split_part(e.key, '|', 3) = 'spend' then e.value::numeric else 0 end) as spend,
           sum(case when split_part(e.key, '|', 3) = 'income' then e.value::numeric else 0 end) as income
    from s3_in s, jsonb_each_text(coalesce(s.eff, '{}'::jsonb)) e group by 1;
  select count(*) into bad from (
    select k from t_before union select k from t_after union select k from t_pred) keys
    where abs(coalesce((select spend from t_after a where a.k = keys.k), 0) - coalesce((select spend from t_before a where a.k = keys.k), 0) - coalesce((select spend from t_pred a where a.k = keys.k), 0)) > 0.005
       or abs(coalesce((select income from t_after a where a.k = keys.k), 0) - coalesce((select income from t_before a where a.k = keys.k), 0) - coalesce((select income from t_pred a where a.k = keys.k), 0)) > 0.005;
  res := res || E'\n' || case when bad = 0 then 'PASS' else 'FAIL' end || ' (3) per-user per-month totals after the apply equal before + the prediction (mismatching keys: ' || bad || ')';
  select count(*) into n from (select k from t_pred where abs(spend) > 0.005 or abs(income) > 0.005) q;
  res := res || E'\n' || 'INFO (3) months whose figure the batch moves: ' || n;
  for r in select k, spend sp, income inc from t_pred where abs(spend) >= 1 or abs(income) >= 1 order by 1 loop
    res := res || E'\n' || 'INFO (3) stale month ' || r.k || ' spending ' || r.sp || ' income ' || r.inc;
  end loop;

  ---------------------------------------------------------------- (4) a stale phone push cannot undo a repaired value; a later edit wins
  -- T11 row: server retag to Transfer is protected by server_rev; the push echoes the older revision
  select s.lid into t_lid from s3_in s where s.prefix = '08ca4f8f';
  select id, server_rev into t_id, rev0 from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set category = 'Utilities', server_rev = 0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select category::text = 'Transfer' and 'topup_repaired' = any (sms_flags) and server_rev >= 1 from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4a) a stale push of the old category does not undo a repaired purchase and keeps its flag';
  update expenses set sms_flags = null, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select 'topup_repaired' = any (sms_flags) from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4b) a push cannot remove a server flag';
  -- T15 expense and income
  select s.lid into t_lid from s3_in s where s.prefix = '737c4e4c';
  select id into t_id from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set expense_date = (s.ex ->> 'day')::date, server_rev = 0, edited_at = clock_timestamp() from s3_in s where s.prefix = '737c4e4c' and expenses.id = t_id;
  res := res || E'\n' || case when (select expense_date = (s.ex ->> 'new_day')::date from expenses e, s3_in s where e.id = t_id and s.prefix = '737c4e4c') then 'PASS' else 'FAIL' end || ' (4c) a stale push of the old day does not undo a day shift (expense)';
  select s.lid into t_lid from s3_in s where s.prefix = '02370960';
  select id into t_id from income_events where sms_log_id = t_lid and deleted_at is null;
  update income_events set received_date = (s.ex ->> 'day')::date, server_rev = 0, edited_at = clock_timestamp() from s3_in s where s.prefix = '02370960' and income_events.id = t_id;
  res := res || E'\n' || case when (select received_date = (s.ex ->> 'new_day')::date from income_events e, s3_in s where e.id = t_id and s.prefix = '02370960') then 'PASS' else 'FAIL' end || ' (4d) a stale push of the old day does not undo a day shift (income)';
  -- T3: the retracted income cannot be revived by a push
  select s.lid into t_lid from s3_in s where s.prefix = '4b5d53d7';
  update income_events set deleted_at = null, edited_at = clock_timestamp() where sms_log_id = t_lid;
  res := res || E'\n' || case when (select deleted_at is not null and retracted_by_sms_log_id = t_lid from income_events where sms_log_id = t_lid) then 'PASS' else 'FAIL' end || ' (4e) a push cannot revive a retracted income';
  -- T1: the cleared decline stamp cannot be set again by a push
  select s.lid into t_lid from s3_in s where s.prefix = '9e75b537';
  update expenses set refunded_at = now(), refund_kind = 'declined', edited_at = clock_timestamp() where sms_log_id = t_lid and deleted_at is null;
  res := res || E'\n' || case when (select refunded_at is null and refund_kind is null from expenses where sms_log_id = t_lid and deleted_at is null) then 'PASS' else 'FAIL' end || ' (4f) a push cannot re-stamp an un-reversed row';
  -- a genuinely later edit wins: the user recategorises the repaired purchase (same spending effect) and moves the shifted income within the month
  select s.lid into t_lid from s3_in s where s.prefix = '08ca4f8f';
  select id, server_rev into t_id, rev0 from expenses where sms_log_id = t_lid and deleted_at is null;
  update expenses set category = 'Food', server_rev = rev0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select category::text = 'Food' from expenses where id = t_id) then 'PASS' else 'FAIL' end || ' (4g) a later user edit that echoes the current revision wins over the repair';
  select s.lid into t_lid from s3_in s where s.prefix = '02370960';
  select id, server_rev into t_id, rev0 from income_events where sms_log_id = t_lid and deleted_at is null;
  update income_events set received_date = received_date + 1, server_rev = rev0, edited_at = clock_timestamp() where id = t_id;
  res := res || E'\n' || case when (select received_date = (s.ex ->> 'new_day')::date + 1 from income_events e, s3_in s where e.id = t_id and s.prefix = '02370960') then 'PASS' else 'FAIL' end || ' (4h) a later user day edit wins over the repair';

  ---------------------------------------------------------------- (5) prompts and queues
  create temp table flags_after on commit drop as
    select left(user_id::text, 8) u8, unnest(sms_flags) f from expenses where sms_log_id is not null and deleted_at is null and sms_flags is not null
    union all select left(user_id::text, 8), unnest(sms_flags) from income_events where sms_log_id is not null and deleted_at is null and sms_flags is not null;
  for r in select u8, f, count(*) c from (select * from flags_after except all select * from flags_before) d where f not like 'topup_prev:%' group by 1, 2 order by 1, 2 loop
    res := res || E'\n' || 'INFO (5) new flag on live rows, user ' || r.u8 || ' ' || r.f || ' x' || r.c;
  end loop;
  select count(*) into v_notif2 from notifications;
  select count(*) filter (where pushed_at is not null) into v_pushed2 from sms_parse_log;
  select count(*) into v_signals2 from sms_template_signals;
  select count(*) filter (where discard_requested_at is not null) into v_discard2 from sms_parse_log;
  res := res || E'\n' || case when v_notif = v_notif2 and v_pushed = v_pushed2 and v_signals = v_signals2 and v_discard = v_discard2 then 'PASS' else 'FAIL' end
         || ' (5) no notification, no push stamp, no template signal and no discard request was queued by the apply';

  ---------------------------------------------------------------- (6) the revert: totals return to the start, a user edit survives
  out := sms_s3_revert(b);
  res := res || E'\n' || 'INFO (6) revert: ' || (out ->> 'reverted') || ' restored, skipped ' || (out -> 'skipped')::text;
  res := res || E'\n' || case when jsonb_array_length(out -> 'skipped') <= 3 then 'PASS' else 'FAIL' end || ' (6) only the rows a user edited or a push touched were skipped (at most the 3 edited above)';
  execute 'create temp table t_rev on commit drop as ' || totals_sql;
  select count(*) into bad from (select k from t_before union select k from t_rev) keys
   where coalesce((select spend from t_rev a where a.k = keys.k), 0) <> coalesce((select spend from t_before a where a.k = keys.k), 0)
      or coalesce((select income from t_rev a where a.k = keys.k), 0) <> coalesce((select income from t_before a where a.k = keys.k), 0);
  res := res || E'\n' || case when bad = 0 then 'PASS' else 'FAIL' end || ' (6) per-user per-month totals after the revert equal the starting totals (mismatching keys: ' || bad || ')';
  select s.lid into t_lid from s3_in s where s.prefix = '08ca4f8f';
  res := res || E'\n' || case when (select category::text = 'Food' and not ('topup_repaired' = any (coalesce(sms_flags, '{}'))) from expenses where sms_log_id = t_lid and deleted_at is null) then 'PASS' else 'FAIL' end
         || ' (6) the user''s later category edit survives the revert, the untouched flags are restored';
  select s.lid into t_lid from s3_in s where s.prefix = '02370960';
  res := res || E'\n' || case when (select received_date = (s.ex ->> 'new_day')::date + 1 from income_events e, s3_in s where e.sms_log_id = t_lid and e.deleted_at is null and s.prefix = '02370960') then 'PASS' else 'FAIL' end || ' (6) the user''s later day edit survives the revert';
  select count(*) into n from expenses e join s3_in s on s.lid = e.sms_log_id where s.prefix in ('9e75b537', 'bfe884e3', 'e8b0e3ed') and e.deleted_at is null
     and ((s.prefix = '9e75b537' and e.refunded_at is not null and e.refund_sms_log_id is not null) or (s.prefix = 'bfe884e3' and e.refunded_at is not null) or (s.prefix = 'e8b0e3ed' and e.refunded_at is null));
  res := res || E'\n' || case when n = 3 then 'PASS' else 'FAIL ' || n end || ' (6) the decline stamp and the refund-mark move are back as they were';
  select count(*) into n from sms_parse_log where discard_requested_at is not null;
  res := res || E'\n' || case when n = v_discard then 'PASS' else 'FAIL' end || ' (6) the revert queued no discard';

  ---------------------------------------------------------------- (7) a user edit to an inserted row survives its revert
  select s.lid, s.ins into t_lid, p from s3_in s where s.prefix = '540077ff';
  insert into expenses (user_id, description, category, amount, currency, expense_date, sms_log_id)
    select u.user_id, 's3 sim', (p ->> 'cat')::expense_category, (p ->> 'amt')::numeric, (p ->> 'ccy')::currency_code, (p ->> 'day')::date, t_lid from sms_parse_log u where u.id = t_lid returning id into rid;
  perform sms_s3_record_insert(b2, 'T6', t_lid, 'expenses', rid);
  update expenses set notes = 'user note', edited_at = clock_timestamp() where id = rid;
  out := sms_s3_revert(b2);
  res := res || E'\n' || case when (select deleted_at is null from expenses where id = rid) and (out #>> '{skipped,0,note}') = 'edited_after_apply' then 'PASS' else 'FAIL ' || out::text end || ' (7) an inserted row the user edited stays after the revert';
  select s.lid into t_lid from s3_in s where s.prefix = 'ec6ae237';
  insert into expenses (user_id, description, category, amount, currency, expense_date, sms_log_id)
    select u.user_id, 's3 sim', 'Other', 1, 'SAR', current_date, t_lid from sms_parse_log u where u.id = t_lid returning id into rid;
  perform sms_s3_record_insert(b2 || 'x', 'T6', t_lid, 'expenses', rid);
  out := sms_s3_revert(b2 || 'x');
  res := res || E'\n' || case when (select deleted_at is not null and retracted_by_sms_log_id = t_lid from expenses where id = rid) then 'PASS' else 'FAIL' end || ' (7) an untouched inserted row is soft-deleted with its marker by the revert';

  raise exception 'ROLLBACK_OK %', res;
end $$;
