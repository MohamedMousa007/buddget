-- 0351: re-stamp borrow / lend principal legs dated at or before their account's balance anchor (QA W4 P1).
--
-- The balance engine treats every row at or before an account's opening_at as already inside the opening balance,
-- so a leg the user explicitly booked ("Arrived in <account>", default No before the anchor) with an earlier borrow
-- date never moved the account. The app now stamps such a leg 1 ms after the anchor (principalLegAt). This moves the
-- legs saved before that fix the same way. Amounts are untouched: only principal_at changes.
--
-- Safety: only legs saved while that anchor already existed (debt created after opening_at). A leg whose account was
-- re-anchored after the debt was saved is left alone: its money may really be inside the newer opening balance.
-- Idempotent: a re-stamped leg sits after its anchor, so a second run matches nothing.
-- edited_at moves to now() so a device still holding the old leg cannot write it back (reject_stale_write).
-- Not applied by the agent that wrote it: the owner applies it.

set local statement_timeout = '30s';

with legs as (
  select d.id, acct.opening_at
  from public.debts d
  join public.payment_methods pm on pm.id = d.principal_payment_method_id
  left join public.payment_methods parent on parent.id = pm.parent_id and pm.type = 'debit_card'
  cross join lateral (select coalesce(parent.opening_at, pm.opening_at) as opening_at,
                             coalesce(parent.opening_balance, pm.opening_balance) as opening_balance,
                             coalesce(parent.deleted_at, pm.deleted_at) as deleted_at) acct
  where d.debt_type = 'personal'
    and d.deleted_at is null
    and not coalesce(d.is_gold, false)
    and d.principal_amount is not null
    and d.principal_at is not null
    and acct.deleted_at is null
    and acct.opening_balance is not null
    and acct.opening_at is not null
    and d.principal_at <= acct.opening_at
    and d.created_at > acct.opening_at
)
update public.debts d
set principal_at = legs.opening_at + interval '1 millisecond',
    edited_at = now()
from legs
where d.id = legs.id;
