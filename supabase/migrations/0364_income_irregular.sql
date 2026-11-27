-- 0364_income_irregular.sql  (final-ui v9, Income: How often -> Irregular; council D6 "Irregular income never late")
-- NOTE: LOGIC_SPEC §196 names the P6 contract migration "0364_retire_columns.sql". That file is not written yet; it
--   takes the next free number when it is (renumber the spec reference). This file holds 0364.
-- PURPOSE
--   income_sources gains is_irregular boolean not null default false.
--   An irregular source has no fixed payday: `amount` is about how much a month, and an unpaid month is never late or
--   missed (the client engine shows it as awaiting; nothing in SQL derives late/missed). recurring_frequency stays
--   'monthly' for these rows, so the shared recurring_frequency enum (debts, templates) is untouched and old native
--   builds read an irregular source as a plain monthly one.
--   Additive only: the column is optional on write, so old builds' upserts never send or clear it. sync_pull_v2 /
--   sync_table_delta return whole rows; no RPC lists income_sources columns for this field. No backfill.
--   Ship order (§8 OQ-1): apply this file before the web deploy that carries ui/v9-gaps; the new client sends the new
--   column(s) on every upsert of this table, so without it every write of the table fails.
--
-- BEFORE-COUNTS (run first; expected in brackets)
--   select count(*) from public.income_sources where deleted_at is null;                                [any]
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'income_sources' and column_name = 'is_irregular'; [0]
--
-- EXPECTED ROWS TOUCHED: 0 (a constant default adds the column without a table rewrite).
--
-- ROLLBACK
--   alter table public.income_sources drop column if exists is_irregular;

alter table public.income_sources
  add column if not exists is_irregular boolean not null default false;

comment on column public.income_sources.is_irregular is
  'No fixed payday: amount is about how much a month; an unpaid month is never late (final-ui v9).';
