-- I8 known limit: a phone holding an older copy of a row could overwrite columns both sides may write after the server
-- changed them (undoing a pairing retag to Transfer). server_rev is a row version the server bumps and the client echoes.
--
-- Nullable on purpose: a bulk upsert mixing rows with and without the key sends NULL for the missing ones, and NOT NULL would
-- reject the whole batch. The trigger reads the stored value as coalesce(old.server_rev, 0).
--
-- Additive, so the deployed app and server keep working: a client that does not send the column leaves it at its stored
-- value, which the trigger reads as "fresh" (new.server_rev = old.server_rev, or NULL: not older). Nothing that writes today
-- changes behaviour until a client echoes an older value.

alter table public.expenses add column if not exists server_rev integer default 0;
alter table public.income_events add column if not exists server_rev integer default 0;

comment on column public.expenses.server_rev is 'Bumped by the stale-write trigger whenever a server write changes a column both sides may write. A client echoes the value it pulled; a client write carrying an older value keeps the stored values of those columns.';
comment on column public.income_events.server_rev is 'Bumped by the stale-write trigger whenever a server write changes a column both sides may write. A client echoes the value it pulled; a client write carrying an older value keeps the stored values of those columns.';

create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.edited_at is not distinct from old.edited_at then
    if tg_table_name = 'expenses' then
      new.server_rev := coalesce(old.server_rev, 0) + case
        when new.amount is distinct from old.amount
          or new.currency is distinct from old.currency
          or new.payment_method_id is distinct from old.payment_method_id
          or new.to_payment_method_id is distinct from old.to_payment_method_id
          or new.expense_date is distinct from old.expense_date
          or new.spend_exclusion is distinct from old.spend_exclusion
          or (new.category::text is distinct from old.category::text
              and (old.category::text in ('Savings', 'ATM Cash Withdrawal', 'Transfer', 'Currency Exchange', 'CC Payoff', 'Top up', 'Installment')
                   or new.category::text in ('Savings', 'ATM Cash Withdrawal', 'Transfer', 'Currency Exchange', 'CC Payoff', 'Top up', 'Installment')))
        then 1 else 0 end;
    elsif tg_table_name = 'income_events' then
      new.server_rev := coalesce(old.server_rev, 0) + case
        when new.amount is distinct from old.amount
          or new.currency is distinct from old.currency
          or new.payment_method_id is distinct from old.payment_method_id
          or new.received_date is distinct from old.received_date
        then 1 else 0 end;
    end if;
    return new;
  end if;
  new.edited_at := least(new.edited_at, now());
  if new.edited_at >= old.edited_at - interval '3 seconds' then
    new.edited_at := greatest(new.edited_at, old.edited_at);
  elsif old.deleted_at is not null and new.deleted_at is null then
    new := old;
    new.deleted_at := null;
  else
    return null;
  end if;

  if tg_table_name = 'expenses' then
    new.sms_log_id := old.sms_log_id;
    new.refunded_at := old.refunded_at;
    new.refund_kind := old.refund_kind;
    new.refund_sms_log_id := old.refund_sms_log_id;
    new.refunded_amount := old.refunded_amount;
    new.retracted_by_sms_log_id := old.retracted_by_sms_log_id;
    new.sms_flags := old.sms_flags;
    if old.retracted_by_sms_log_id is not null then
      new.deleted_at := old.deleted_at;
    end if;
    if new.server_rev is not null and new.server_rev < coalesce(old.server_rev, 0) then
      new.category := old.category;
      new.amount := old.amount;
      new.currency := old.currency;
      new.payment_method_id := old.payment_method_id;
      new.to_payment_method_id := old.to_payment_method_id;
      new.expense_date := old.expense_date;
      new.spend_exclusion := old.spend_exclusion;
    end if;
    new.server_rev := coalesce(old.server_rev, 0);
  elsif tg_table_name = 'income_events' then
    new.sms_log_id := old.sms_log_id;
    new.retracted_by_sms_log_id := old.retracted_by_sms_log_id;
    new.sms_flags := old.sms_flags;
    if old.retracted_by_sms_log_id is not null then
      new.deleted_at := old.deleted_at;
    end if;
    if new.server_rev is not null and new.server_rev < coalesce(old.server_rev, 0) then
      new.amount := old.amount;
      new.currency := old.currency;
      new.payment_method_id := old.payment_method_id;
      new.received_date := old.received_date;
    end if;
    new.server_rev := coalesce(old.server_rev, 0);
  end if;
  return new;
end $$;
