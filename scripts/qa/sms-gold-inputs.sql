-- Gold-set export for src/lib/sms/gold (docs/launch/S1-sms-audit.md section 3). Read-only.
-- Run on the live project, save the `dump` value to .claude/sms-gold-inputs.json (gitignored), then split the L_*
-- keys into src/lib/sms/gold/goldSet.json (labels only). No message text is selected. The merchant is exported for
-- purchase-like kinds only; on transfer rows it can be a person's name, so only a short hash leaves the database.
-- Holdout: ('x' || left(md5(id::text), 2))::bit(8)::int < 77.
-- Labels are rule-derived: top-up = a purchase and a credit of the same amount within 10 minutes; relay = a credit
-- and an outgoing transfer of the same amount on the same account within 10 minutes; fx = the leg's ledger direction.
with l as (select * from sms_parse_log),
ok as (select * from l where parsed_ok and not is_duplicate),
topup as (
  select p.id pid, i.id iid from ok p
  join ok i on i.user_id = p.user_id and i.amount = p.amount and i.currency = p.currency
    and abs(extract(epoch from p.received_at - i.received_at)) <= 600 and p.id <> i.id
  where p.kind in ('purchase', 'online_purchase', 'own_transfer') and i.kind in ('income', 'instant_transfer_in')),
relay as (
  select a.id aid, b.id bid from ok a
  join ok b on a.user_id = b.user_id and a.amount = b.amount and a.currency = b.currency
    and a.account_last4 = b.account_last4 and abs(extract(epoch from a.received_at - b.received_at)) <= 600
  where a.kind in ('instant_transfer_in', 'income') and b.kind = 'instant_transfer_out'),
rows as (
  select jsonb_strip_nulls(jsonb_build_object(
    'id', l.id, 'u', left(l.user_id::text, 8), 'h', (('x' || left(md5(l.id::text), 2))::bit(8)::int < 77),
    'k', l.kind, 'st', l.status, 'pm', l.parse_method, 'a', l.amount, 'c', l.currency,
    't', l.account_last4, 'ct', l.counterparty_last4, 'b', l.bank_name, 's', nullif(l.sender, ''),
    'ts', extract(epoch from l.received_at)::bigint,
    'm', case when l.kind in ('purchase', 'online_purchase', 'declined', 'fee', 'refund', 'atm_withdrawal') then l.merchant end,
    'mh', case when l.kind not in ('purchase', 'online_purchase', 'declined', 'fee', 'refund', 'atm_withdrawal') and l.merchant is not null then left(md5(lower(l.merchant)), 8) end,
    'mn', case when l.merchant_normalized is not null then 1 end, 'cat', l.category, 'pid', l.pattern_id,
    'sk', left(l.skeleton_key, 10), 'ld', l.leg_direction, 'pl', l.paired_log_id, 'dup', case when l.is_duplicate then 1 end,
    'e', case when e.id is not null then 1 end, 'epm', e.payment_method_id, 'eto', e.to_payment_method_id, 'ecat', e.category::text,
    'i', case when i.id is not null then 1 end, 'ipm', i.payment_method_id,
    'L_topup', (select coalesce(min(t.iid::text) filter (where t.pid = l.id), min(t.pid::text) filter (where t.iid = l.id)) from topup t where l.id in (t.pid, t.iid)),
    'L_relay', (select coalesce(min(r.bid::text) filter (where r.aid = l.id), min(r.aid::text) filter (where r.bid = l.id)) from relay r where l.id in (r.aid, r.bid)),
    'L_fx', case when l.kind = 'currency_exchange' then coalesce(l.leg_direction, 'unknown') end
  )) j
  from l
  left join expenses e on e.sms_log_id = l.id and e.deleted_at is null and e.description <> 'Transfer fee'
  left join income_events i on i.sms_log_id = l.id and i.deleted_at is null
  order by l.received_at),
methods as (
  select jsonb_build_object('id', id, 'u', left(user_id::text, 8), 'type', type, 'c', currency, 't', last4,
    'al', last4_aliases, 'name', name, 'closed', closed_at is not null) j
  from payment_methods where deleted_at is null and user_id in (select distinct user_id from l))
select jsonb_build_object('rows', (select jsonb_agg(j) from rows), 'methods', (select jsonb_agg(j) from methods))::text as dump;
