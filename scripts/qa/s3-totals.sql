-- S3 step 1 check: per-user, per-month totals of the SMS-booked money rows, to compare with the dry run
-- (docs/launch/S3-rerun.md, table "by user and month") before and after an apply. Read only.
-- Spending = a live expense that is not refunded, not excluded and not in a non-spend category. Income = a live, non-excluded income row.
-- Run it before the batch, after step 1 and after the revert test: after = before + the predicted effect, after a revert = before.
select left(user_id::text, 8) as user8, currency::text as currency, to_char(d, 'YYYY-MM') as month,
       round(sum(spend), 2) as spending, round(sum(income), 2) as income
from (
  select user_id, currency, expense_date as d,
         case when refunded_at is null and spend_exclusion is null
                   and category::text not in ('Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange') then amount else 0 end as spend,
         0::numeric as income
  from expenses where sms_log_id is not null and deleted_at is null
  union all
  select user_id, currency, received_date, 0, case when exclusion is null then amount else 0 end
  from income_events where sms_log_id is not null and deleted_at is null
) t
group by 1, 2, 3 order by 1, 2, 3;
