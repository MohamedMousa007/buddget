-- Sync redesign part 2: "newest EDIT wins", decided on `edited_at` (replaces the arrival-time comparison of 0232).
--
-- INSERT  (a0_stamp_insert): updated_at is always the server's now() (REG-1: an offline-created row must reach other
--         devices' delta pulls, which page by updated_at); edited_at is the client edit time clamped to <= now() (OFS-1).
-- UPDATE  (a0_reject_stale_write): a write that does not change edited_at (server-side writer, tombstone, unchanged
--         re-send) always passes and leaves edited_at alone (REG-4). A write that carries a different edited_at is a
--         user edit: clamped to <= now() (OFS-1), accepted when it is not older than the stored edit time, otherwise
--         skipped (SLG-2). Edits under 3 s apart are not told apart (clock-offset jitter): the later push wins.
--         A stale undo-of-delete (revive) only brings the row back; the newer stored content is kept (REG-6).
create or replace function private.stamp_insert() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.edited_at := least(coalesce(new.edited_at, now()), now());
  new.updated_at := now();
  return new;
end $$;

create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.edited_at is not distinct from old.edited_at then
    return new;
  end if;
  new.edited_at := least(new.edited_at, now());
  if new.edited_at >= old.edited_at - interval '3 seconds' then
    new.edited_at := greatest(new.edited_at, old.edited_at);
    return new;
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    new := old;
    new.deleted_at := null;
    return new;
  end if;
  return null;
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
    execute format('drop trigger if exists a0_stamp_insert on public.%I', t);
    execute format('create trigger a0_stamp_insert before insert on public.%I for each row execute function private.stamp_insert()', t);
  end loop;
end $$;
