-- D-5 and D-9 (QA round 2): two rules for client writes on deleted rows, added in front of the 0319 body (unchanged).
--
-- D-5: a client delete time is clamped to the server's now() the way edited_at already is. Before, a device clock ahead
--      of the server (or an offset learned with latency) put deleted_at in the server's future; the Undo that followed
--      was clamped to now() and so counted as older than the delete, and the restore was refused with no message.
-- D-9: a client write that touches a row which is already deleted and does not revive it is skipped: an offline edit no
--      longer lands its content on a tombstone, and a re-sent tombstone no longer moves deleted_at later (which would
--      in turn beat a real Undo). The skip shows in the upsert count, so the app re-pulls and drops its copy.
--
-- Only signed-in users' writes; service-role and SQL jobs keep today's behaviour. Trigger function only: no new query,
-- no index, same signature, works with the deployed app.
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
