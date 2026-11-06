-- Sync redesign (QA round 6: REG-1, REG-4, OFS-1, SLG-2), part 1: the edit-time column.
-- `edited_at` is the time a USER last edited the row (client edit time on the server clock, clamped to now()).
-- It is written only by user-originated pushes and never moved by server-side writers (SMS pairing, price cron,
-- month-carry, income adoption). `updated_at` keeps one meaning: the server's own write time, the pull cursor.
-- Backfill: edited_at = updated_at (the best edit time known today). Triggers are disabled for the backfill so no
-- other trigger fires and updated_at is not bumped (that would re-send every row to every device).
do $$
declare t text;
begin
  foreach t in array array[
    'payment_methods','income_sources','income_events','expenses','receipts','recurring_expenses','subscriptions','debts',
    'debt_payments','recurring_debt_payments','savings_accounts','savings_holdings','savings_transactions',
    'recurring_savings_deposits','goals','buddgy_memories','account_adjustments',
    'budget_plans','budget_categories','budget_subcategories','budget_plan_activations'
  ] loop
    execute format('alter table public.%I add column if not exists edited_at timestamptz', t);
    execute format('alter table public.%I disable trigger user', t);
    execute format('update public.%I set edited_at = updated_at where edited_at is null', t);
    execute format('alter table public.%I enable trigger user', t);
    execute format('alter table public.%I alter column edited_at set default now(), alter column edited_at set not null', t);
  end loop;
end $$;
