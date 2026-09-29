-- Paydays reorder: the order a user drags their paydays into, which Flow's In chips and the
-- add-income picker follow. Nullable; unset rows sort as 0, then by creation.
alter table public.income_sources add column if not exists sort_order integer;
