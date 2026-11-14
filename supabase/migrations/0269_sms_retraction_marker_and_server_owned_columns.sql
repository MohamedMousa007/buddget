-- S2c step 1 (invariants I4 and I8). Additive columns, a stricter stale-write trigger, and a one-off marker backfill.
--
-- I4: when the SMS pairing code soft-deletes a money row it also records which message caused it
--     (retracted_by_sms_log_id). A restore needs that marker, so a row the user deleted is never brought back by the server.
-- I8: columns the server stamps cannot be changed by a client write. A phone holding an older copy of a row pushes the
--     whole row with a newer edit time, which would wipe what the server stamped since. The app has no user action that
--     sets these columns, so a client write never needs to change them.
--
-- No foreign key on retracted_by_sms_log_id, same reason as sms_log_id (0205): sms_parse_log rows are purged.
-- All columns are nullable with no default, so adding them rewrites nothing and fires no trigger.

alter table public.expenses add column if not exists retracted_by_sms_log_id uuid;
alter table public.income_events add column if not exists retracted_by_sms_log_id uuid;
alter table public.expenses add column if not exists sms_flags text[];
alter table public.income_events add column if not exists sms_flags text[];
alter table public.expenses add column if not exists sms_flags_ack text[];
alter table public.income_events add column if not exists sms_flags_ack text[];

create index if not exists expenses_retracted_by_sms_log_idx on public.expenses (retracted_by_sms_log_id) where retracted_by_sms_log_id is not null;
create index if not exists income_events_retracted_by_sms_log_idx on public.income_events (retracted_by_sms_log_id) where retracted_by_sms_log_id is not null;

comment on column public.expenses.retracted_by_sms_log_id is 'The message whose pairing retracted this row. Set together with deleted_at only by the SMS pairing code; a restore requires it. deleted_at without it is the user''s own delete.';
comment on column public.income_events.retracted_by_sms_log_id is 'The message whose pairing retracted this row. Set together with deleted_at only by the SMS pairing code; a restore requires it. deleted_at without it is the user''s own delete.';
comment on column public.expenses.sms_flags is 'Server-stamped flags on a row a message created (possible_duplicate, date_unsure, refund_unmatched, model_kind_unproven, cash_deposit). Not writable by the client.';
comment on column public.income_events.sms_flags is 'Server-stamped flags on a row a message created (possible_duplicate, date_unsure, refund_unmatched, model_kind_unproven, cash_deposit). Not writable by the client.';
comment on column public.expenses.sms_flags_ack is 'The flags in sms_flags the user has dismissed. Written by the app.';
comment on column public.income_events.sms_flags_ack is 'The flags in sms_flags the user has dismissed. Written by the app.';

-- Same behaviour as 0241 for every table. For expenses and income_events, a client write (one that carries a different
-- edited_at) first has the server-owned columns put back to their stored values on every path that returns a row,
-- including the stale revive. Server writers do not change edited_at and pass through untouched. Any future
-- "mark as refunded" action must go through its own endpoint, not a client write.
-- The field references sit inside the table-name branches because this function is shared by about 21 tables and
-- plpgsql only resolves record fields when the statement runs.
create or replace function private.reject_stale_write() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.edited_at is not distinct from old.edited_at then
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
    new.retracted_by_sms_log_id := old.retracted_by_sms_log_id;
    new.sms_flags := old.sms_flags;
    if old.retracted_by_sms_log_id is not null then
      new.deleted_at := old.deleted_at;
    end if;
  elsif tg_table_name = 'income_events' then
    new.sms_log_id := old.sms_log_id;
    new.retracted_by_sms_log_id := old.retracted_by_sms_log_id;
    new.sms_flags := old.sms_flags;
    if old.retracted_by_sms_log_id is not null then
      new.deleted_at := old.deleted_at;
    end if;
  end if;
  return new;
end $$;

-- One-off: pairs retracted before this migration stay undoable. The pairing code leaves a fixed signature on the
-- retracted leg: the row is soft-deleted, its log is 'paired', the log no longer points at the row, and the log's
-- paired_log_id names the message that caused the retraction (src/lib/sms/pairing.ts, reconcileSibling and
-- reconcileCcPayoffFundingLeg). edited_at is not touched, so no sync tier sees a client edit.
update public.income_events e
set retracted_by_sms_log_id = l.paired_log_id
from public.sms_parse_log l
where l.id = e.sms_log_id
  and e.deleted_at is not null
  and e.retracted_by_sms_log_id is null
  and l.status = 'paired'
  and l.income_id is null
  and l.paired_log_id is not null;

update public.expenses e
set retracted_by_sms_log_id = l.paired_log_id
from public.sms_parse_log l
where l.id = e.sms_log_id
  and e.deleted_at is not null
  and e.retracted_by_sms_log_id is null
  and l.status = 'paired'
  and l.expense_id is null
  and l.paired_log_id is not null;
