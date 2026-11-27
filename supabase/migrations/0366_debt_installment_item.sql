-- 0366_debt_installment_item.sql  (final-ui v9, Add installment: item type chips and the item tile; ROUND9 #4)
-- PURPOSE
--   debts gains:
--     installment_item_type text  -- phone | laptop | appliance | furniture | car | other; null = not chosen (legacy).
--     installment_item_icon text  -- a key of the shared icon set (GOAL_ICON_SET) for item type 'other'; null = the
--                                    type's own icon.
--   Editing an installment reads both back, so the tile keeps the type picked at creation. debts.emoji is left alone
--   (it carries the family emoji the add sheet writes, e.g. the card emoji).
--   Additive only: both optional on write, old builds never send or clear them. Whole-row sync. No backfill.
--   Ship order (§8 OQ-1): apply this file before the web deploy that carries ui/v9-gaps; the new client sends the new
--   column(s) on every upsert of this table, so without it every write of the table fails.
--
-- BEFORE-COUNTS (run first; expected in brackets)
--   select count(*) from public.debts where debt_type = 'installment' and deleted_at is null;          [any]
--   select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'debts'
--    and column_name in ('installment_item_type', 'installment_item_icon');                           [0]
--
-- EXPECTED ROWS TOUCHED: 0.
--
-- ROLLBACK
--   alter table public.debts drop column if exists installment_item_type, drop column if exists installment_item_icon;

alter table public.debts
  add column if not exists installment_item_type text,
  add column if not exists installment_item_icon text;

alter table public.debts drop constraint if exists debts_installment_item_type_check;
alter table public.debts
  add constraint debts_installment_item_type_check
  check (installment_item_type is null or installment_item_type in ('phone', 'laptop', 'appliance', 'furniture', 'car', 'other'));

alter table public.debts drop constraint if exists debts_installment_item_icon_key;
alter table public.debts
  add constraint debts_installment_item_icon_key
  check (installment_item_icon is null or installment_item_icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(installment_item_icon) <= 40);
