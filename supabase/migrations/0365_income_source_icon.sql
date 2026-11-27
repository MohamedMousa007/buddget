-- 0365_income_source_icon.sql  (final-ui v9, Add income source: the icon is editable for Other; ROUND9 #3, #4)
-- PURPOSE
--   income_sources gains icon text (null = the type's own icon). Holds a key of the app's shared icon set
--   (GOAL_ICON_SET, the one goals use), e.g. 'graduation-cap'. Set only for source_type 'other' by the client; any
--   type may carry it, the client ignores it elsewhere. The CHECK keeps it a short kebab-case key, never free text.
--   Additive only: optional on write, old builds never send or clear it. Whole-row sync, no RPC column lists. No backfill.
--   Ship order (§8 OQ-1): apply this file before the web deploy that carries ui/v9-gaps; the new client sends the new
--   column(s) on every upsert of this table, so without it every write of the table fails.
--
-- BEFORE-COUNTS (run first; expected in brackets)
--   select count(*) from information_schema.columns
--    where table_schema = 'public' and table_name = 'income_sources' and column_name = 'icon'; [0]
--
-- EXPECTED ROWS TOUCHED: 0.
--
-- ROLLBACK
--   alter table public.income_sources drop column if exists icon;

alter table public.income_sources
  add column if not exists icon text;

alter table public.income_sources
  drop constraint if exists income_sources_icon_key;
alter table public.income_sources
  add constraint income_sources_icon_key check (icon is null or icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(icon) <= 40);
