-- QA-41: a delete can only be undone by an action newer than the delete (owner decision 2026-11-19; replaces REG-6 from
-- 0241, "an undo always brings the row back, even with an old edit time").
--
-- A device that re-sends a row it never recorded as delivered offers it as an insert with deleted_at = null and the
-- row's old edit time. That cleared a tombstone another device had written, so a deleted row came back for everyone.
-- Now a client write clears a tombstone only when its edit time is after the delete; otherwise the row stays deleted
-- (the rest of the write still follows the normal rules). Apps stamp a fresh edit time on every Undo.
--
-- Only writes made as a signed-in user are held to this. Server code (service role) and SQL jobs keep clearing
-- tombstones as they do today (e.g. the SMS flag route putting a retracted row back).
--
-- Trigger function only: no new query, no index. Body otherwise identical to 0278.
create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if old.deleted_at is not null and new.deleted_at is null
     and coalesce(auth.role(), '') = 'authenticated'
     and (new.edited_at is null or new.edited_at <= old.deleted_at) then
    new.deleted_at := old.deleted_at;
  end if;

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
