-- SYN6: a stale write must not overwrite a newer server row.
-- The client sends `updated_at` = the time of its edit (corrected to server time). The server stamps its own
-- `updated_at` = now() on every accepted update (set_updated_at), so a row's stored value is the time of its newest
-- accepted write. An UPDATE (incl. the ON CONFLICT DO UPDATE leg of an upsert) whose supplied updated_at is OLDER than
-- the stored one is a stale offline edit and is skipped (BEFORE trigger returning NULL). Writers that do not set
-- updated_at (edge functions, cron, tombstones) keep NEW.updated_at = OLD.updated_at and pass.
-- A revive (deleted_at set -> NULL, i.e. undo of a delete) always passes. The one-minute tolerance covers the gap between
-- a client's edit time and the server's receipt time (the server stamps now() on arrival), so a quick follow-up edit on
-- the same device is never mistaken for a stale one; concurrent edits closer than that fall back to last-pusher-wins.

-- SYN9: activations get an edit stamp so sync_pull can return deleted ids in a window.
alter table public.budget_plan_activations add column if not exists updated_at timestamptz not null default now();
update public.budget_plan_activations set updated_at = coalesce(deleted_at, created_at);

create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.updated_at < old.updated_at - interval '1 minute' and not (old.deleted_at is not null and new.deleted_at is null) then
    return null;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'payment_methods','income_sources','income_events','expenses','receipts','recurring_expenses','subscriptions','debts',
    'debt_payments','recurring_debt_payments','savings_accounts','savings_holdings','savings_transactions',
    'recurring_savings_deposits','goals','buddgy_memories','account_adjustments',
    'budget_plans','budget_categories','budget_subcategories','budget_plan_activations'
  ] loop
    execute format('drop trigger if exists a0_reject_stale_write on public.%I', t);
    execute format('create trigger a0_reject_stale_write before update on public.%I for each row execute function private.reject_stale_write()', t);
  end loop;
end $$;

drop trigger if exists trg_budget_plan_activations_updated_at on public.budget_plan_activations;
create trigger trg_budget_plan_activations_updated_at before update on public.budget_plan_activations
  for each row execute function public.set_updated_at();
