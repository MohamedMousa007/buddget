-- docs/SYSTEM_CASH_PLAN.md, phase 2 for the data (owner, 2026-11-19: every user is a tester, change their data now).
-- 1. Every user without an open real Cash gets the system Cash: the id the app derives (systemCashId: each hex digit of
--    the user id replaced by 15 minus it), untracked (no opening balance), edit time 2000-01-01 so any real edit wins.
-- 2. Expenses and recurring expenses that carry no method and that the app reads as Cash move onto the user's Cash
--    (their oldest open real Cash, as cashAccountId picks). Balances do not change: those rows already counted as Cash.
-- Left as they are, on purpose:
--    - expenses from a bank SMS that named no account (shown as "Unassigned", kept out of every balance);
--    - income events and debt payments with no method: the app reads those as "no account", not Cash, and the ones
--      that really were cash cannot be told apart.
-- Aborts, changing nothing, if a count or a per-user expense total moves. Safe to run again.
begin;
set local statement_timeout = '20s';

create temp table _before on commit drop as
  select user_id, count(*) as n, sum(amount) as total from public.expenses where deleted_at is null group by user_id;

insert into public.payment_methods (id, user_id, name, type, currency, color, is_default, track_sms, excluded, provisional, created_at, edited_at)
select (substr(h,1,8)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||substr(h,17,4)||'-'||substr(h,21,12))::uuid,
       u.id, 'Cash', 'cash', coalesce(p.base_currency, 'EGP'), '#C9C9D4', false, true, false, false,
       '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z'
from auth.users u
left join public.profiles p on p.id = u.id
cross join lateral (select translate(replace(u.id::text, '-', ''), '0123456789abcdef', 'fedcba9876543210') as h) t
where not exists (select 1 from public.payment_methods m where m.user_id = u.id and m.type = 'cash' and m.closed_at is null and m.deleted_at is null)
on conflict (id) do nothing;

create temp table _cash on commit drop as
  select distinct on (user_id) user_id, id from public.payment_methods
  where type = 'cash' and closed_at is null and deleted_at is null
  order by user_id, created_at, id;

update public.expenses e set payment_method_id = c.id, updated_at = now()
from _cash c
where e.user_id = c.user_id and e.payment_method_id is null and e.sms_log_id is null and e.category is distinct from 'CC Payoff';

update public.recurring_expenses r set payment_method_id = c.id, updated_at = now()
from _cash c
where r.user_id = c.user_id and r.payment_method_id is null;

do $$
declare bad int;
begin
  select count(*) into bad from auth.users u
  where (select count(*) from public.payment_methods m where m.user_id = u.id and m.type = 'cash' and m.closed_at is null and m.deleted_at is null) <> 1;
  if bad > 0 then raise exception 'system cash: % users do not have exactly one open Cash', bad; end if;
  select count(*) into bad from (
    select b.user_id from _before b
    left join (select user_id, count(*) as n, sum(amount) as total from public.expenses where deleted_at is null group by user_id) a using (user_id)
    where a.n is distinct from b.n or a.total is distinct from b.total) x;
  if bad > 0 then raise exception 'system cash: expense count or total moved for % users', bad; end if;
  select count(*) into bad from public.expenses where payment_method_id is null and sms_log_id is null and category is distinct from 'CC Payoff';
  if bad > 0 then raise exception 'system cash: % cash expenses still carry no method', bad; end if;
end $$;

commit;
