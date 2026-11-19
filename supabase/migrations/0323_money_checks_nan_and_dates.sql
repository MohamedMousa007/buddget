-- QA-60: numeric 'NaN' sorts above every number, so `amount > 0` lets it through and
-- one NaN row poisons every SUM. An upper bound rejects NaN and Infinity in one
-- comparison. The app writes these tables directly (RLS), so the table is the real
-- door; the v2 savings RPCs get the same guard as a second layer.
-- QA-62: savings dates bounded to 2000-2100 (constant limits; a CHECK must not use now()).
-- Pre-check on 2026-11-19: 0 violating rows in every column below.

alter table public.expenses drop constraint expenses_amount_pos;
alter table public.expenses add constraint expenses_amount_pos check (amount > 0 and amount < 1e16) not valid;
alter table public.expenses add constraint expenses_refunded_amount_sane
  check (refunded_amount is null or (refunded_amount >= 0 and refunded_amount < 1e16)) not valid;

alter table public.income_events drop constraint income_events_amount_pos;
alter table public.income_events add constraint income_events_amount_pos check (amount > 0 and amount < 1e16) not valid;

alter table public.debt_payments drop constraint debt_payments_amount_pos;
alter table public.debt_payments add constraint debt_payments_amount_pos check (amount > 0 and amount < 1e16) not valid;

alter table public.savings_transactions add constraint savings_transactions_amount_sane
  check (amount >= 0 and amount < 1e16) not valid;
alter table public.savings_transactions add constraint savings_transactions_balance_after_sane
  check (balance_after is null or (balance_after > -1e16 and balance_after < 1e16)) not valid;
alter table public.savings_transactions add constraint savings_transactions_date_sane
  check (transaction_date >= date '2000-01-01' and transaction_date < date '2100-01-01') not valid;

alter table public.savings_accounts add constraint savings_accounts_balance_sane
  check ((current_balance is null or (current_balance > -1e16 and current_balance < 1e16))
     and (opening_balance is null or (opening_balance > -1e16 and opening_balance < 1e16))) not valid;

alter table public.expenses validate constraint expenses_amount_pos;
alter table public.expenses validate constraint expenses_refunded_amount_sane;
alter table public.income_events validate constraint income_events_amount_pos;
alter table public.debt_payments validate constraint debt_payments_amount_pos;
alter table public.savings_transactions validate constraint savings_transactions_amount_sane;
alter table public.savings_transactions validate constraint savings_transactions_balance_after_sane;
alter table public.savings_transactions validate constraint savings_transactions_date_sane;
alter table public.savings_accounts validate constraint savings_accounts_balance_sane;

-- RPC guards: swap only the amount/balance guard line in the live bodies; CREATE OR
-- REPLACE keeps the grants (authenticated + service_role, as 0315 left them).
do $$
declare
  r record;
  def text;
  fixed text;
begin
  for r in select * from (values
    ('public.deposit_to_savings_v2(uuid,numeric,currency_code,date,uuid,text)'::regprocedure,
     'IF p_amount IS NULL OR p_amount <= 0 THEN', 'IF p_amount IS NULL OR NOT (p_amount > 0 AND p_amount < 1e16) THEN'),
    ('public.withdraw_from_savings_v2(uuid,numeric,currency_code,date,uuid,text)'::regprocedure,
     'IF p_amount IS NULL OR p_amount <= 0 THEN', 'IF p_amount IS NULL OR NOT (p_amount > 0 AND p_amount < 1e16) THEN'),
    ('public.correct_savings_balance_v2(uuid,numeric,date,uuid,text)'::regprocedure,
     'IF p_new_balance IS NULL OR p_new_balance < 0 THEN', 'IF p_new_balance IS NULL OR NOT (p_new_balance >= 0 AND p_new_balance < 1e16) THEN')
  ) v(fn, old_guard, new_guard) loop
    def := pg_get_functiondef(r.fn);
    if position(r.new_guard in def) > 0 then continue; end if;
    fixed := replace(def, r.old_guard, r.new_guard);
    assert fixed <> def, format('guard not found in %s', r.fn);
    execute fixed;
  end loop;
end $$;

do $$
begin
  begin
    insert into public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'deposit', 'NaN', 'EGP', current_date);
    raise exception 'NaN accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.savings_transactions (id, user_id, account_id, kind, amount, currency, transaction_date)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'deposit', 1, 'EGP', date '2999-01-01');
    raise exception '2999 accepted';
  exception when check_violation then null;
  end;
end $$;
