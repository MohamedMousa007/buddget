-- p3_counts.sql: read-only checks before applying P3 (0360-0361). Counts and ids only, no names, emails or amounts.
-- Run each statement on its own (not as one script), off peak. EXPLAIN is never ANALYZE. Expected values in brackets.
-- Section "AFTER" runs once the migrations are applied (the new column and index do not exist before).

-- ================================================================ 0 · environment
-- 0.1 neither new column exists yet [0 rows]
select table_name, column_name from information_schema.columns
where table_schema = 'public' and table_name = 'payment_methods'
  and column_name in ('pays_from_payment_method_id', 'is_savings');
-- 0.2 live trigger definitions on payment_methods (0360 replaces link_guard_payment_methods: its args must be
--     'parent_id', 'payment_methods' as in 0326; anything else must be merged into 0360 first)
select t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace and c.relname = 'payment_methods' and not t.tgisinternal
order by t.tgname;
-- 0.3 'credit_card' is a value of the installment_provider enum [1 row]
select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
where t.typname = 'installment_provider' and e.enumlabel = 'credit_card';

-- ================================================================ 0360 · cards and savings accounts
-- 0360.1 live credit cards with no parent account (each will ask "pays this card from") [small]
select count(*) from public.payment_methods
where type = 'credit_card' and parent_id is null and deleted_at is null and closed_at is null;
-- 0360.2 of those, cards with a credit-card debt (only these can hold money back) [<= 0360.1]
select count(*) from public.payment_methods pm
where pm.type = 'credit_card' and pm.parent_id is null and pm.deleted_at is null and pm.closed_at is null
  and exists (select 1 from public.debts d
              where d.user_id = pm.user_id and d.debt_type = 'credit_card' and d.linked_payment_method_id = pm.id
                and d.deleted_at is null);

-- ================================================================ 0361 · card plans
-- 0361.1 live card plans [small]
select count(*) from public.debts
where debt_type = 'installment' and installment_provider = 'credit_card' and deleted_at is null;
-- 0361.2 card plans with no linked card [?]
select count(*) from public.debts
where debt_type = 'installment' and installment_provider = 'credit_card' and deleted_at is null
  and linked_credit_card_debt_id is null;
-- 0361.3 the rows step 1 links: unlinked card plans whose user has exactly one live card. SAVE THESE IDS (rollback).
select p.id as plan_id, c.card_id
from public.debts p
join (select user_id, min(id::text)::uuid as card_id from public.debts
      where debt_type = 'credit_card' and deleted_at is null
      group by user_id having count(*) = 1) c on c.user_id = p.user_id
where p.debt_type = 'installment' and p.installment_provider = 'credit_card' and p.deleted_at is null
  and p.linked_credit_card_debt_id is null
limit 200;
-- 0361.4 unlinked card plans whose user has 2+ cards (left unlinked; still owed on their own) [?]
select count(*) from public.debts p
where p.debt_type = 'installment' and p.installment_provider = 'credit_card' and p.deleted_at is null
  and p.linked_credit_card_debt_id is null
  and (select count(*) from public.debts c where c.user_id = p.user_id and c.debt_type = 'credit_card' and c.deleted_at is null) >= 2;
-- 0361.5 OQ-3: plans linked to a card (now, and as step 1 would leave them) with no purchase charge on it [0]; ids only
with linked as (
  select p.id, p.user_id, p.starting_balance, p.created_at, p.installment_start_date,
         coalesce(p.linked_credit_card_debt_id, s.card_id) as card_debt_id
  from public.debts p
  left join (select user_id, min(id::text)::uuid as card_id from public.debts
             where debt_type = 'credit_card' and deleted_at is null
             group by user_id having count(*) = 1) s
    on s.user_id = p.user_id and p.installment_provider = 'credit_card'
  where p.debt_type = 'installment' and p.deleted_at is null
)
select l.id as plan_id
from linked l
join public.debts c on c.id = l.card_debt_id and c.deleted_at is null
where not exists (
  select 1 from public.expenses e
  where e.user_id = l.user_id and e.deleted_at is null
    and e.payment_method_id = c.linked_payment_method_id
    and not e.is_debt_payment
    and (e.linked_debt_id = l.id
      or (e.amount = l.starting_balance
          and (abs(e.expense_date::date - coalesce(l.installment_start_date::date, l.created_at::date)) <= 3
            or abs(e.expense_date::date - l.created_at::date) <= 3))))
limit 50;
-- 0361.6 instalment rows already written on card plans, by category (left as they are; for the report) [any]
select e.category, count(*)
from public.expenses e
join public.debts p on p.id = e.linked_debt_id
where e.is_debt_payment and e.deleted_at is null and p.debt_type = 'installment' and p.installment_provider = 'credit_card'
group by e.category;

-- ================================================================ EXPLAIN (no ANALYZE) on live, before applying
-- E.1 the single-card linking step (expect index use on debts by user_id; debts is small per user)
explain
with single_card as (
  select user_id, min(id::text)::uuid as card_id from public.debts
  where debt_type = 'credit_card' and deleted_at is null group by user_id having count(*) = 1
)
select p.id from public.debts p join single_card c on c.user_id = p.user_id
where p.installment_provider = 'credit_card' and p.debt_type = 'installment'
  and p.linked_credit_card_debt_id is null and p.deleted_at is null;
-- E.2 the OQ-3 anti-join (the expenses side must use an index on user_id / payment_method_id, no seq scan)
explain
select count(*) from public.debts p
join public.debts c on c.id = p.linked_credit_card_debt_id and c.deleted_at is null
where p.debt_type = 'installment' and p.deleted_at is null
  and not exists (select 1 from public.expenses e
                  where e.user_id = p.user_id and e.deleted_at is null
                    and e.payment_method_id = c.linked_payment_method_id and not e.is_debt_payment
                    and (e.linked_debt_id = p.id or e.amount = p.starting_balance));

-- ================================================================ AFTER (once 0360-0361 are applied)
-- A.1 both columns and the index exist [2 rows; 1 row]
select column_name, data_type, is_nullable, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'payment_methods'
  and column_name in ('pays_from_payment_method_id', 'is_savings');
select indexname from pg_indexes where schemaname = 'public' and indexname = 'payment_methods_pays_from_idx';
-- A.2 the guard covers both link columns [def lists parent_id and pays_from_payment_method_id]
select pg_get_triggerdef(t.oid) from pg_trigger t
where t.tgrelid = 'public.payment_methods'::regclass and t.tgname = 'link_guard_payment_methods';
-- A.3 unlinked card plans of single-card users [0]; re-run 0361.5 [0 rows]
select count(*) from public.debts p
where p.debt_type = 'installment' and p.installment_provider = 'credit_card' and p.deleted_at is null
  and p.linked_credit_card_debt_id is null
  and (select count(*) from public.debts c where c.user_id = p.user_id and c.debt_type = 'credit_card' and c.deleted_at is null) = 1;
-- A.4 get_advisors (security and performance) reports nothing new for payment_methods.
