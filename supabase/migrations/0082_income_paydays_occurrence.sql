-- Multi-payday days per recurring source (monthly 1, biweekly 2, weekly 4).
alter table public.income_sources
  add column if not exists payday_days int[] default null;

-- Which scheduled payday an event fulfills — the dedupe/pairing key that makes
-- "mark received" idempotent per occurrence.
alter table public.income_events
  add column if not exists occurrence_date date default null;

-- One live event per (template, scheduled payday). Legacy rows (null
-- occurrence_date) are exempt and keep pairing positionally in the app.
create unique index if not exists income_events_template_occurrence_uniq
  on public.income_events (template_id, occurrence_date)
  where deleted_at is null
    and template_id is not null
    and occurrence_date is not null;
