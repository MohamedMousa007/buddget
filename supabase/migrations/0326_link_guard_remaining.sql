-- QA-98: link columns that still accepted another user's ids. Scalars join the existing
-- link_guard_* triggers (private.assert_link_owner, 0250: a missing parent is allowed, another
-- user's parent raises 23503). uuid arrays get private.assert_link_array_owner, same convention.
-- Pre-check on 2026-11-19: 0 existing cross-user links in every column below, so the purge
-- guards from 0251 need no owner scoping (nothing can point across users any more).
-- Cost: one primary-key lookup per non-null link, on write only.

drop trigger if exists link_guard_expenses on public.expenses;
create trigger link_guard_expenses before insert or update on public.expenses
  for each row execute function private.assert_link_owner(
    'payment_method_id', 'payment_methods', 'linked_debt_id', 'debts', 'linked_debt_payment_id', 'debt_payments',
    'to_payment_method_id', 'payment_methods', 'linked_subscription_id', 'subscriptions', 'receipt_id', 'receipts',
    'refund_sms_log_id', 'sms_parse_log', 'sms_log_id', 'sms_parse_log', 'retracted_by_sms_log_id', 'sms_parse_log',
    'funded_from_savings_tx_id', 'savings_transactions');

drop trigger if exists link_guard_debt_payments on public.debt_payments;
create trigger link_guard_debt_payments before insert or update on public.debt_payments
  for each row execute function private.assert_link_owner(
    'debt_id', 'debts', 'payment_method_id', 'payment_methods', 'sms_log_id', 'sms_parse_log',
    'funded_from_savings_tx_id', 'savings_transactions');

drop trigger if exists link_guard_income_events on public.income_events;
create trigger link_guard_income_events before insert or update on public.income_events
  for each row execute function private.assert_link_owner(
    'template_id', 'income_sources', 'linked_debt_id', 'debts', 'linked_savings_account_id', 'savings_accounts',
    'payment_method_id', 'payment_methods', 'sms_log_id', 'sms_parse_log', 'retracted_by_sms_log_id', 'sms_parse_log');

drop trigger if exists link_guard_payment_methods on public.payment_methods;
create trigger link_guard_payment_methods before insert or update on public.payment_methods
  for each row execute function private.assert_link_owner('parent_id', 'payment_methods');

-- Args: (array column, parent table) pairs. Raises when any id in the array belongs to another user.
create or replace function private.assert_link_array_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  i int := 0;
  ids uuid[];
  foreign_row boolean;
begin
  while i < TG_NARGS loop
    ids := (select array_agg(v::uuid) from jsonb_array_elements_text(to_jsonb(NEW) -> TG_ARGV[i]) v);
    if ids is not null then
      execute format('select exists (select 1 from public.%I where id = any($1) and user_id <> $2)', TG_ARGV[i + 1])
        into foreign_row using ids, NEW.user_id;
      if foreign_row then
        raise exception 'link %.% points at another user''s row', TG_TABLE_NAME, TG_ARGV[i] using errcode = '23503';
      end if;
    end if;
    i := i + 2;
  end loop;
  return NEW;
end $function$;

revoke all on function private.assert_link_array_owner() from public, anon, authenticated;

drop trigger if exists link_array_guard_goals on public.goals;
create trigger link_array_guard_goals before insert or update on public.goals
  for each row execute function private.assert_link_array_owner(
    'linked_savings_account_ids', 'savings_accounts', 'linked_debt_ids', 'debts');

-- link_ids holds debt ids or a goal id depending on link_type; check both parents.
drop trigger if exists link_array_guard_budget_categories on public.budget_categories;
create trigger link_array_guard_budget_categories before insert or update on public.budget_categories
  for each row execute function private.assert_link_array_owner('link_ids', 'debts', 'link_ids', 'goals');
