-- D-5 follow-up (QA round 2, runner job 7): an Undo lost to the delete it followed, intermittently.
--
-- 0331 holds a client delete time at the server's now(). The Undo carries the device's edit time on the server's clock,
-- which is only as exact as the learned offset (a test runner or a phone a moment behind the database), so an Undo
-- made right after the delete could still read as older than it and the row stayed deleted. The revive rule now gets
-- the same 3-second tolerance edits already have ("edits under 3 s apart are not told apart"): a client write clears a
-- tombstone unless its edit time is more than 3 s before the delete. A stale re-send of an old row (QA-41) carries an
-- edit time far older than that, so it still stays deleted.
--
-- Trigger function only, body otherwise identical to 0331. No query, no index, same signature.
create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    -- D-9: a client write to a row that is already deleted, which does not bring it back, changes nothing (an offline
    -- edit landing on a tombstone, or a re-sent tombstone that would move the delete time). Skipped: the app re-pulls.
    if old.deleted_at is not null and new.deleted_at is not null then
      return null;
    end if;
    -- D-5: a client delete time is held at the server's now, like edited_at (OFS-1). A device clock ahead of the server
    -- stamped tombstones in the server's future, so the Undo that followed (clamped to now) looked older than the delete.
    if old.deleted_at is null and new.deleted_at is not null then
      new.deleted_at := least(new.deleted_at, now());
    end if;
  end if;

  -- D-5 (0334): an Undo counts as newer than the delete unless it is more than 3 s older, the same tolerance edits get.
  if old.deleted_at is not null and new.deleted_at is null
     and coalesce(auth.role(), '') = 'authenticated'
     and (new.edited_at is null or new.edited_at < old.deleted_at - interval '3 seconds') then
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
