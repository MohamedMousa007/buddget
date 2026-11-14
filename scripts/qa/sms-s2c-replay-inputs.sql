-- Inputs for the S2c closing replay (src/lib/sms/gold/closingReplay.ts). Read only: SELECT statements only.
-- The result is personal data (masked message text, merchant and account names). Save it ONLY under .claude/ (git-ignored)
-- as .claude/sms-s2c-replay.json and never commit it. raw_body is never selected.
--
-- Shape of the saved file: { "logCols", "logs", "pms", "debts", "answers", "liveExpCols", "liveExp", "liveInc", "created" }.
-- Every log value is text (null stays null). Identifiers are cut to their first 8 characters (unique across the table:
-- query B), users are numbered u1..uN by the order of their ids, devices are a 6-character hash: only equality matters.
--
-- A. The log, ordered by id (collation C). The whole table (957 rows) is about 380 KB, so the tool saves the answer to a
--    file instead of printing it: parse it from there rather than copying it. For a bigger table use OFFSET and LIMIT
--    pages. The checksum lets the local copy prove it holds the rows exactly: md5 over the row values joined by the
--    unit separator (chr 31), rows joined by the record separator (chr 30), nulls as empty strings.
-- B. Sanity: select count(*), count(distinct left(id::text, 8)) from sms_parse_log;
-- C. Payment methods, D. debts, E. own-transfer answers: one call each (small, written into pms, debts, answers).
-- F. What the live data books for each message (liveExp, liveInc) and G. the arrival time of each row (created): the
--    replay classifies live outcomes from F and breaks ties between messages with the same capture second with G.

-- A.
with users as (
  select user_id, 'u' || dense_rank() over (order by user_id) as u from (select distinct user_id from sms_parse_log) d
),
-- Rows the route never dispatches (rejected or failed, or with no kind or amount) carry no text: only their identity.
page as (
  select
    array[
      left(l.id::text, 8), m.u, l.kind, l.status, l.parse_method, l.amount::text, l.currency, l.account_last4,
      l.counterparty_last4, l.counterparty_hash, l.counterparty_is_self::text, l.reference_hash,
      left(md5(l.device_id::text), 6), to_char(l.received_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      l.is_duplicate::text, l.awaiting_confirmation::text, left(l.paired_log_id::text, 8),
      (l.expense_id is not null)::text, (l.income_id is not null)::text,
      case when sk.v then null else l.merchant_normalized end, case when sk.v then null else l.clean_title end,
      case when sk.v then null else l.bank_name end, case when sk.v then null else l.sender end, l.leg_direction,
      case when sk.v then null else l.masked_body end, l.own_transfer_verdict, l.failure_code,
      left(l.matched_template_id::text, 8), l.parsed_ok::text, case when sk.v then null else l.merchant end,
      exists (select 1 from expenses e where e.sms_log_id = l.id and e.deleted_at is null)::text,
      exists (select 1 from income_events i where i.sms_log_id = l.id and i.deleted_at is null)::text,
      l.category, l.payment_instrument
    ]::text[] as arr
  from sms_parse_log l join users m on m.user_id = l.user_id
  cross join lateral (select (l.status in ('rejected', 'failed') or l.amount is null or l.kind is null) as v) sk
  order by left(l.id::text, 8) collate "C"
  offset 0 limit 1000
)
select jsonb_build_object(
  'logCols', jsonb_build_array('id','u','kind','status','parse_method','amount','currency','account_last4','counterparty_last4','counterparty_hash','counterparty_is_self','reference_hash','device','received_at','is_duplicate','awaiting_confirmation','paired','has_expense_id','has_income_id','merchant_normalized','clean_title','bank_name','sender','leg_direction','masked_body','own_transfer_verdict','failure_code','matched_template','parsed_ok','merchant','live_expense','live_income','category','payment_instrument'),
  'rows', (select jsonb_agg(to_jsonb(arr) order by arr[1] collate "C") from page),
  'checksum', (select md5(string_agg(array_to_string(arr, chr(31), ''), chr(30) order by arr[1] collate "C")) from page)
) as page;

-- C.
-- with users as (select user_id, 'u' || dense_rank() over (order by user_id) u from (select distinct user_id from sms_parse_log) d)
-- select u.u, left(p.id::text, 8) id, p.name, p.type, p.currency, p.last4, p.last4_aliases, p.provisional,
--   p.closed_at is not null closed, p.parent_id is not null has_parent, p.excluded, p.track_sms, p.is_default
-- from payment_methods p join users u on u.user_id = p.user_id where p.deleted_at is null order by p.id;

-- D.
-- with users as (select user_id, 'u' || dense_rank() over (order by user_id) u from (select distinct user_id from sms_parse_log) d)
-- select u.u, left(d.id::text, 8) id, d.debt_type, d.direction, d.currency, left(d.linked_payment_method_id::text, 8) linked_pm,
--   d.is_gold, d.installment_amount, d.installment_provider, d.installment_provider_name, d.status,
--   d.cleared_at is not null cleared, d.remaining_amount, d.amount, d.name
-- from debts d join users u on u.user_id = d.user_id where d.deleted_at is null order by d.id;

-- E.
-- with users as (select user_id, 'u' || dense_rank() over (order by user_id) u from (select distinct user_id from sms_parse_log) d)
-- select u.u, a.account_a, a.account_b, a.is_own from sms_own_transfer_answers a join users u on u.user_id = a.user_id;

-- F.
-- select jsonb_build_object(
--  'exp', (select jsonb_agg(jsonb_build_array(left(e.sms_log_id::text,8), e.category::text, e.refund_kind, left(e.refund_sms_log_id::text,8), e.refunded_at::text, e.payment_method_id is not null, e.to_payment_method_id is not null, e.sms_flags) order by e.sms_log_id)
--           from expenses e where e.sms_log_id is not null and e.deleted_at is null and e.description is distinct from 'Transfer fee'),
--  'inc', (select jsonb_agg(jsonb_build_array(left(i.sms_log_id::text,8), i.source_type::text, i.sms_flags) order by i.sms_log_id)
--           from income_events i where i.sms_log_id is not null and i.deleted_at is null)) as live;

-- G.
-- select jsonb_object_agg(left(id::text,8), to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) as created from sms_parse_log;
