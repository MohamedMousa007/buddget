#!/usr/bin/env python3
"""
S3b direct-SQL inserts (owner decision, docs/launch/S3-dryrun.md section 14): prints one DO block that books the T7b and T6 rows
the booking function would have written, shaped on a live row the app booked for the same kind, audits each insert and relinks
the log pointer. Rehearsal (--rollback) always ends in an exception 'ROLLBACK_OK <lines>'; a real run raises 'ABORT <lines>' on any
failed check (so nothing persists) and returns silently when every check passes.

  python3 scripts/qa/s3-gen-direct-insert.py --batch s3-20261115-s3 --types T7b,T6 [--only 0fe8887c] [--rollback] > run.sql
"""
import argparse

# prefix, user prefix, type, table, description (None = the log's clean_title), category, amount, currency, day, refund_kind, reference kind
ROWS = [
    ('0fe8887c', 'f923c68b', 'T7b', 'expenses', 'Bank transaction', 'Other', '4000', 'EGP', '2026-09-09', 'declined', 'declined'),
    ('4a7d7250', '6090c8e7', 'T7b', 'expenses', 'Anthropic', 'Other', '5.7', 'USD', '2026-10-27', 'declined', 'declined'),
    ('540077ff', 'f923c68b', 'T6', 'expenses', 'Apple.Com/Bill', 'Subscription', '99.99', 'SAR', '2026-08-10', None, 'apple'),
    ('fa2a8ec2', 'b85f074d', 'T6', 'expenses', 'Sahl', 'Other', '499.05', 'EGP', '2026-07-13', None, 'purchase'),
    ('ad8523cb', 'b85f074d', 'T6', 'expenses', None, 'ATM Cash Withdrawal', '1000', 'EGP', '2026-07-12', None, 'atm'),
    ('916e58d4', 'f923c68b', 'T6', 'income_events', None, 'other', '100', 'SAR', '2026-09-11', None, 'income'),
    ('acbe9dd7', 'f923c68b', 'T6', 'income_events', None, 'other', '100', 'SAR', '2026-08-13', None, 'income'),
]

TOTALS_SQL = r"""
    select left(user_id::text, 8) || '|' || currency::text || '|' || to_char(d, 'YYYY-MM') as k, round(sum(spend), 2) as spend, round(sum(income), 2) as income
    from (
      select user_id, currency, expense_date as d,
             case when refunded_at is null and spend_exclusion is null
                       and category::text not in ('Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange') then amount else 0 end as spend, 0::numeric as income
      from expenses where sms_log_id is not null and deleted_at is null
      union all
      select user_id, currency, received_date, 0, case when exclusion is null then amount else 0 end
      from income_events where sms_log_id is not null and deleted_at is null
    ) t group by 1"""

# keys that may differ from the reference: identity, the message's own facts and timestamps, and category_label (written only by the
# client sync mapper, so a server-booked row has it null until a phone syncs it)
ALLOWED = ['category_label', 'id', 'user_id', 'description', 'name', 'amount', 'currency', 'expense_date', 'received_date', 'occurred_at', 'created_at',
           'updated_at', 'edited_at', 'sms_log_id', 'refund_sms_log_id', 'refunded_at']


def sql(batch, types, only, rollback):
    rows = [r for r in ROWS if r[2] in types and (not only or r[0] in only)]
    values = ',\n      '.join(
        "('{}','{}','{}','{}',{},'{}',{}::numeric,'{}','{}'::date,{},'{}')".format(
            p, u, t, tb, "'" + d.replace("'", "''") + "'" if d else 'null', c, a, cur, day, "'" + rk + "'" if rk else 'null', ref)
        for p, u, t, tb, d, c, a, cur, day, rk, ref in rows)
    allowed = ', '.join("'" + k + "'" for k in ALLOWED)
    return f"""do $$
declare
  b constant text := '{batch}';
  rb constant boolean := {'true' if rollback else 'false'};
  totals_sql constant text := $q${TOTALS_SQL} $q$;
  res text := ''; sp record; lg record; uid uuid; newid uuid; refid uuid; pm uuid; n int; bad int; oldptr uuid; ptrcol text; newj jsonb; refj jsonb; dk text; v_notif int; v_pushed int; v_signals int; v_discard int;
  t0 timestamptz := transaction_timestamp(); newids uuid[] := '{{}}'; pm_before int; fails int;
begin
  perform set_config('statement_timeout', '90000', true);
  create temp table spec on commit drop as select * from (values
      {values}
  ) v(prefix, usr, rtype, tbl, descr, cat, amt, ccy, dy, rk, ref);
  select count(*) into n from spec;
  res := res || E'\\n' || 'INFO rows in scope ' || n;
  select count(*) into v_notif from notifications;
  select count(*) filter (where pushed_at is not null) into v_pushed from sms_parse_log;
  select count(*) into v_signals from sms_template_signals;
  select count(*) filter (where discard_requested_at is not null) into v_discard from sms_parse_log;
  select count(*) into pm_before from payment_methods;
  execute 'create temp table t_before on commit drop as ' || totals_sql;
  create temp table ptr_before on commit drop as select l.id, l.expense_id, l.income_id from sms_parse_log l join spec on l.id::text like spec.prefix || '%' and left(l.user_id::text, 8) = spec.usr;

  for sp in select * from spec order by rtype, prefix loop
    select l.* into lg from sms_parse_log l where l.id::text like sp.prefix || '%' and left(l.user_id::text, 8) = sp.usr;
    uid := lg.user_id;
    select count(*) into n from (select 1 from expenses where sms_log_id = lg.id and deleted_at is null union all select 1 from income_events where sms_log_id = lg.id and deleted_at is null) q;
    res := res || E'\\n' || case when n = 0 then 'PASS' else 'FAIL' end || ' (' || sp.prefix || ') the message owns no live money row before the insert (' || n || ')';
    res := res || E'\\n' || case when lg.amount = sp.amt and lg.currency::text = sp.ccy then 'PASS' else 'FAIL' end || ' (' || sp.prefix || ') the log amount and currency are the report row''s';

    -- the account the booking function would resolve: the one registered method this tail names (a provisional one is not created here)
    select (array_agg(m.id))[1], count(*) into pm, n from payment_methods m
      where m.user_id = uid and m.deleted_at is null and not (coalesce(m.provisional, false) and m.closed_at is not null)
        and lg.account_last4 is not null and (m.last4 = lg.account_last4 or lg.account_last4 = any (coalesce(m.last4_aliases, '{{}}')));
    if n <> 1 then pm := null; end if;
    if sp.tbl = 'income_events' then pm := null; end if;

    if sp.tbl = 'expenses' then
      insert into expenses (user_id, expense_date, occurred_at, to_payment_method_id, description, category, category_source, amount, currency, payment_method_id, notes,
                            linked_subscription_id, sms_log_id, refunded_at, refund_kind, refund_sms_log_id, sms_flags)
      values (uid, sp.dy, lg.received_at, null, coalesce(sp.descr, lg.clean_title, 'Bank transaction'), sp.cat::public.expense_category, null, sp.amt, sp.ccy::public.currency_code, pm, null,
              null, lg.id, case when sp.rk is not null then sp.dy end, sp.rk, case when sp.rk is not null then lg.id end, null)
      returning id into newid;
      ptrcol := 'expense_id';
    else
      insert into income_events (user_id, template_id, name, amount, currency, source_type, received_date, occurrence_date, status, sms_log_id, payment_method_id, occurred_at, notes, sms_flags)
      values (uid, null, coalesce(sp.descr, lg.clean_title, 'Bank credit'), sp.amt, sp.ccy::public.currency_code, 'other'::public.income_source_type, sp.dy, null, 'confirmed'::public.income_event_status,
              lg.id, pm, lg.received_at, null, null)
      returning id into newid;
      ptrcol := 'income_id';
    end if;
    newids := newids || newid;
    perform public.sms_s3_record_insert(b, sp.rtype, lg.id, sp.tbl, newid);

    -- the message's pointer must name this row: filled by the audit function when empty, relinked (audited) when it names another message's row
    execute format('select %I from sms_parse_log where id = $1', ptrcol) into oldptr using lg.id;
    if oldptr is distinct from newid then
      insert into sms_repair_audit (batch, repair_type, user_id, sms_log_id, table_name, row_id, action, old_values, new_values)
      values (b, sp.rtype, uid, lg.id, 'sms_parse_log', lg.id, 'relink', jsonb_build_object(ptrcol, oldptr), jsonb_build_object(ptrcol, newid))
      on conflict do nothing;
      perform private.s3_set('sms_parse_log', lg.id, jsonb_build_object(ptrcol, newid));
    end if;
    execute format('select %I from sms_parse_log where id = $1', ptrcol) into oldptr using lg.id;
    res := res || E'\\n' || case when oldptr = newid then 'PASS' else 'FAIL' end || ' (' || sp.prefix || ') the log pointer names the new row';

    -- the reference: a live row the app itself booked for the same kind, never an audited row
    refid := null;
    if sp.tbl = 'expenses' then
      select e.id into refid from expenses e where e.deleted_at is null and e.notes is null and e.id <> newid and not exists (select 1 from sms_repair_audit a where a.row_id = e.id)
        and left(e.user_id::text, 8) = case when sp.ref = 'declined' then 'f923c68b' else sp.usr end
        and case sp.ref
              when 'declined' then e.refund_kind = 'declined' and e.category = 'Other' and e.sms_flags is null and e.refund_sms_log_id = e.sms_log_id
              when 'apple' then e.description = 'Apple.Com/Bill' and e.category = 'Subscription'
              when 'purchase' then e.category = 'Other' and e.refunded_at is null and e.sms_flags is null and exists (select 1 from sms_parse_log l3 where l3.id = e.sms_log_id and l3.kind = 'purchase')
              when 'atm' then e.category = 'ATM Cash Withdrawal' and e.sms_flags is null
            end
      order by e.created_at desc limit 1;
      select to_jsonb(e) into newj from expenses e where e.id = newid;
      select to_jsonb(e) into refj from expenses e where e.id = refid;
    else
      select i.id into refid from income_events i join sms_parse_log l2 on l2.id = i.sms_log_id
       where i.deleted_at is null and i.id <> newid and not exists (select 1 from sms_repair_audit a where a.row_id = i.id)
         and left(i.user_id::text, 8) = sp.usr and i.source_type = 'other' and i.template_id is null and l2.kind = 'instant_transfer_in' and i.sms_flags is null
       order by i.created_at desc limit 1;
      select to_jsonb(i) into newj from income_events i where i.id = newid;
      select to_jsonb(i) into refj from income_events i where i.id = refid;
    end if;
    res := res || E'\\n' || case when refid is not null then 'PASS' else 'FAIL' end || ' (' || sp.prefix || ') a live app-booked reference row exists (' || sp.ref || ', ' || coalesce(left(refid::text, 8), 'none') || ')';
    select string_agg(k, ',' order by k) into dk from jsonb_object_keys(newj) k
      where newj -> k is distinct from refj -> k and k <> all (array[{allowed}]);
    res := res || E'\\n' || case when dk is null then 'PASS' else 'FAIL' end || ' (' || sp.prefix || ') columns outside the message''s own facts that differ from the reference: ' || coalesce(dk, 'none');
    select string_agg(k, ',' order by k) into dk from jsonb_object_keys(newj) k where newj -> k is distinct from refj -> k and k = any (array[{allowed}]);
    res := res || E'\\n' || 'INFO (' || sp.prefix || ') message-specific columns that differ (expected): ' || coalesce(dk, 'none');
  end loop;

  execute 'create temp table t_after on commit drop as ' || totals_sql;
  create temp table t_pred on commit drop as
    select (s.usr || '|' || split_part(e.key, '|', 1) || '|' || split_part(e.key, '|', 2)) as k,
           sum(case when split_part(e.key, '|', 3) = 'spend' then e.value::numeric else 0 end) as spend,
           sum(case when split_part(e.key, '|', 3) = 'income' then e.value::numeric else 0 end) as income
    from spec s join sms_s3_input x on x.prefix = s.prefix, jsonb_each_text(coalesce(x.eff, '{{}}'::jsonb)) e group by 1;
  select count(*) into bad from (select k from t_before union select k from t_after union select k from t_pred) keys
    where abs(coalesce((select spend from t_after a where a.k = keys.k), 0) - coalesce((select spend from t_before a where a.k = keys.k), 0) - coalesce((select spend from t_pred a where a.k = keys.k), 0)) > 0.005
       or abs(coalesce((select income from t_after a where a.k = keys.k), 0) - coalesce((select income from t_before a where a.k = keys.k), 0) - coalesce((select income from t_pred a where a.k = keys.k), 0)) > 0.005;
  res := res || E'\\n' || case when bad = 0 then 'PASS' else 'FAIL' end || ' totals after the inserts equal before + the report prediction (mismatching keys ' || bad || ')';
  res := res || E'\\n' || 'INFO totals moved: ' || coalesce((select string_agg(a.k || ' spend ' || (a.spend - coalesce(bf.spend, 0)) || ' income ' || (a.income - coalesce(bf.income, 0)), '; ') from t_after a left join t_before bf using (k)
                                                        where a.spend <> coalesce(bf.spend, 0) or a.income <> coalesce(bf.income, 0)), 'none');

  select count(*) into n from (
    select id from expenses where user_id in (select user_id from sms_parse_log where id::text like any (select prefix || '%' from spec)) and updated_at >= t0 and id <> all (newids)
    union all select id from income_events where user_id in (select user_id from sms_parse_log where id::text like any (select prefix || '%' from spec)) and updated_at >= t0 and id <> all (newids)
    union all select id from debt_payments where updated_at >= t0 union all select id from debts where updated_at >= t0 union all select id from subscriptions where updated_at >= t0) q;
  res := res || E'\\n' || case when n = 0 then 'PASS' else 'FAIL ' || n end || ' no other money row, debt, debt payment or subscription was written';
  res := res || E'\\n' || case when pm_before = (select count(*) from payment_methods) then 'PASS' else 'FAIL' end || ' no payment method was created';
  res := res || E'\\n' || case when v_notif = (select count(*) from notifications) and v_pushed = (select count(*) filter (where pushed_at is not null) from sms_parse_log)
                              and v_signals = (select count(*) from sms_template_signals) and v_discard = (select count(*) filter (where discard_requested_at is not null) from sms_parse_log)
                         then 'PASS' else 'FAIL' end || ' no notification, push stamp, template signal or discard request queued';

  if rb then
    declare out jsonb; begin
      out := public.sms_s3_revert(b);
      res := res || E'\\n' || 'INFO revert: ' || (out ->> 'reverted') || ' restored, skipped ' || (out -> 'skipped')::text;
      select count(*) into n from expenses where id = any (newids) and deleted_at is null;
      select n + count(*) into n from income_events where id = any (newids) and deleted_at is null;
      res := res || E'\\n' || case when n = 0 then 'PASS' else 'FAIL ' || n end || ' after the revert every inserted row is soft-deleted';
      select count(*) into n from ptr_before p join sms_parse_log l using (id) where l.expense_id is distinct from p.expense_id or l.income_id is distinct from p.income_id;
      res := res || E'\\n' || case when n = 0 then 'PASS' else 'FAIL ' || n end || ' after the revert every log pointer is back to what it was';
      execute 'create temp table t_rev on commit drop as ' || totals_sql;
      select count(*) into bad from (select k from t_before union select k from t_rev) keys
       where coalesce((select spend from t_rev a where a.k = keys.k), 0) <> coalesce((select spend from t_before a where a.k = keys.k), 0)
          or coalesce((select income from t_rev a where a.k = keys.k), 0) <> coalesce((select income from t_before a where a.k = keys.k), 0);
      res := res || E'\\n' || case when bad = 0 then 'PASS' else 'FAIL ' || bad end || ' totals after the revert equal the starting totals';
    end;
    raise exception 'ROLLBACK_OK %', res;
  end if;

  fails := (length(res) - length(replace(res, 'FAIL', ''))) / 4;
  if fails > 0 then raise exception 'ABORT % %', fails, res; end if;
end $$;
"""


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--batch', required=True)
    ap.add_argument('--types', required=True)
    ap.add_argument('--only', default='')
    ap.add_argument('--rollback', action='store_true')
    a = ap.parse_args()
    print(sql(a.batch, a.types.split(','), [x for x in a.only.split(',') if x], a.rollback))
